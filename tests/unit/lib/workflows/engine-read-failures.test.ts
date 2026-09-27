/**
 * A failed read on the tick and emitter paths is never "nothing to do"
 * (Task 36, audit M4).
 *
 * Every site here used to destructure only `data`, so a database error
 * came back as an empty answer: no stuck steps, no instance, no
 * templates, no wedding date. The tick then reported a clean pass that
 * had done nothing, or acted on the wrong answer. Each case below makes
 * one read fail and pins what must happen instead: the read throws (the
 * tick's guard alerts on it), or the pass counts it as a failed read and
 * leaves the work where the next tick will find it.
 *
 * @module tests/unit/lib/workflows/engine-read-failures.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

const loadDueSteps = vi.fn();
vi.mock('@/lib/workflows/due-steps', () => ({
  loadDueSteps: (...args: unknown[]) => loadDueSteps(...args),
}));
vi.mock('@/lib/workflows/account-pause', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/workflows/account-pause')>()),
  loadAccountPauses: vi.fn(async () => new Map()),
}));

import { loadCoupleSnapshot, loadMcSnapshot } from '@/lib/automations/context';
import { invoiceDueEmitter } from '@/lib/automations/time-emitters/invoice-due';
import { completeBookedAppointmentSteps } from '@/lib/workflows/appointments';
import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';
import {
  advanceDueSteps,
  claimStep,
  completeInstanceIfDone,
  recomputeInstance,
  runStepNow,
  sweepStuckSteps,
} from '@/lib/workflows/executor';
import { readHeartbeat } from '@/lib/workflows/heartbeat';
import { applyTemplate } from '@/lib/workflows/instantiate';
import { isWorkflowReadError } from '@/lib/workflows/read-failure';
import type { AutomationEventRow } from '@/types/automations';
import type { WorkflowInstanceRow } from '@/types/workflows';

import { called, failed, fakeSupabase } from './fake-supabase';

const instance = {
  id: 'instance-1',
  user_id: 'user-1',
  couple_id: 'couple-1',
  template_id: 'template-1',
  status: 'active',
  applied_at: '2026-09-01T00:00:00.000Z',
  is_default: false,
  is_personal: false,
  context: {},
} as unknown as WorkflowInstanceRow;

const event = {
  id: 'event-1',
  user_id: 'user-1',
  couple_id: 'couple-1',
  event_type: 'couple_created',
  payload: {},
  created_at: new Date().toISOString(),
  processed_at: null,
} as unknown as AutomationEventRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('executor reads', () => {
  it('sweepStuckSteps throws when the sweep statement fails, rather than reporting nothing stuck', async () => {
    const { client } = fakeSupabase(() => failed());
    await expect(sweepStuckSteps(client)).rejects.toSatisfy(isWorkflowReadError);
  });

  it('claimStep throws when the claim fails, rather than reading as a lost race', async () => {
    // The claim is the `workflow_claim_step` RPC since the Phase 6 wave.
    const { client } = fakeSupabase(() => failed(), () => failed());
    await expect(claimStep(client, 'step-1')).rejects.toSatisfy(isWorkflowReadError);
  });

  it('completeInstanceIfDone throws when the outstanding-step count fails', async () => {
    const { client } = fakeSupabase((table) =>
      table === 'workflow_instances' ? { data: instance } : failed(),
    );
    await expect(completeInstanceIfDone(client, instance.id)).rejects.toSatisfy(
      isWorkflowReadError,
    );
  });

  it('runStepNow throws when the step read fails, rather than saying the step cannot run', async () => {
    const { client } = fakeSupabase(() => failed());
    await expect(runStepNow(client, 'step-1')).rejects.toSatisfy(isWorkflowReadError);
  });

  it('runStepNow marks a claimed step errored when a read after the claim fails, rather than leaving it running', async () => {
    const step = { id: 'step-1', instance_id: instance.id, type: 'action', status: 'pending', due_at: null, requires_approval: true, config: {} };
    const { client, log } = fakeSupabase((table, calls) => {
      if (table === 'workflow_steps' && called(calls, 'maybeSingle')) return { data: step };
      if (table === 'workflow_steps' && called(calls, 'update')) return { data: [{ id: 'step-1' }] };
      if (table === 'workflow_instances') return { data: instance };
      // The release check reads the step's lane before the claim; it is
      // not one of the reads this test fails.
      if (table === 'workflow_steps' && called(calls, 'eq', 'instance_id')) return { data: [step] };
      // Everything the step's context reads fails.
      return failed();
      // The claim lands (an RPC since the Phase 6 wave).
    }, (fn) => (fn === 'workflow_claim_step' ? { data: true } : { data: null }));

    await expect(runStepNow(client, 'step-1')).rejects.toThrow();

    const errored = log.filter(
      (q) =>
        q.table === 'workflow_steps' &&
        q.calls.some((c) => c.method === 'update' && (c.args[0] as { status?: string }).status === 'errored'),
    );
    expect(errored).toHaveLength(1);
  });

  it('recomputeInstance throws when the step read fails, rather than writing nothing', async () => {
    const { client } = fakeSupabase((table) =>
      table === 'workflow_steps' ? failed() : { data: null },
    );
    await expect(recomputeInstance(client, instance)).rejects.toThrow();
  });

  it('advanceDueSteps counts a failed instance read and carries on with the rest of the batch', async () => {
    loadDueSteps.mockResolvedValue([
      { id: 'step-a', instance_id: 'instance-a', type: 'action', status: 'pending', due_at: '2026-01-01T00:00:00.000Z', requires_approval: false },
      { id: 'step-b', instance_id: 'instance-b', type: 'action', status: 'pending', due_at: '2026-01-01T00:00:00.000Z', requires_approval: false },
    ]);
    const { client, log } = fakeSupabase((table) =>
      table === 'workflow_instances' ? failed() : { data: [] },
    );

    const result = await advanceDueSteps(client);

    expect(result.failedReads).toBe(2);
    expect(result.stepsExecuted).toBe(0);
    // Both steps were tried: one failed read does not end the pass. The
    // reads are batched (Task 38), and a failed batch caches nothing, so
    // the second step asks again rather than reading its instance as gone.
    const instanceReads = log.filter((q) => q.table === 'workflow_instances');
    expect(instanceReads.map((q) => q.calls.find((c) => c.method === 'in')?.args[1])).toEqual([
      ['instance-a'],
      ['instance-b'],
    ]);
    // Nothing was claimed, so both stay due for the next tick.
    expect(log.some((q) => q.table === 'workflow_steps' && called(q.calls, 'update'))).toBe(false);
  });
});

describe('executor batched reads (Task 38)', () => {
  it('skips a step whose instance the batch did not return, without counting a failed read', async () => {
    loadDueSteps.mockResolvedValue([
      { id: 'step-a', instance_id: 'gone-instance', type: 'action', status: 'pending', due_at: '2026-01-01T00:00:00.000Z', requires_approval: false },
    ]);
    const { client, log } = fakeSupabase(() => ({ data: [] }));

    const result = await advanceDueSteps(client);

    // As the single read's null did: the workflow is gone, nothing runs,
    // and nothing is wrong with the database.
    expect(result).toMatchObject({ stepsExecuted: 0, errors: 0, failedReads: 0 });
    expect(log.some((q) => q.table === 'workflow_steps' && called(q.calls, 'update'))).toBe(false);
  });
});

describe('dispatcher reads', () => {
  it('throws when the event batch cannot be read, rather than reporting an empty bus', async () => {
    const { client } = fakeSupabase((table, calls) =>
      table === 'automation_events' && called(calls, 'select') && !called(calls, 'update')
        ? failed()
        : { data: [], count: 0 },
    );
    await expect(dispatchPendingEvents(client)).rejects.toSatisfy(isWorkflowReadError);
  });

  it('leaves an event unprocessed, and counts it, when its templates cannot be read', async () => {
    const { client, log } = fakeSupabase((table, calls) => {
      if (table === 'automation_events' && called(calls, 'update')) return { data: [], count: 0 };
      if (table === 'automation_events') return { data: [event] };
      if (table === 'workflow_templates') return failed();
      return { data: null };
    });

    const result = await dispatchPendingEvents(client);

    expect(result.readFailures).toBe(1);
    // No processed_at stamp for this event: the next tick retries it.
    const stamped = log.filter(
      (q) =>
        q.table === 'automation_events' &&
        called(q.calls, 'update') &&
        called(q.calls, 'eq', 'id'),
    );
    expect(stamped).toHaveLength(0);
  });
});

describe('apply reads', () => {
  it('applyTemplate throws when the template cannot be read, rather than "template not found"', async () => {
    const { client } = fakeSupabase(() => failed());
    await expect(
      applyTemplate(client, { userId: 'user-1', templateId: 'template-1', coupleId: 'couple-1' }),
    ).rejects.toSatisfy(isWorkflowReadError);
  });

  it('applyTemplate throws when the MC timezone cannot be read, rather than scheduling in Sydney', async () => {
    const { client } = fakeSupabase((table) => {
      if (table === 'workflow_templates') {
        return { data: { id: 'template-1', status: 'active', allow_reapply: true, name: 'T', version: 1 } };
      }
      if (table === 'user_public_settings') return failed();
      return { data: null };
    });
    await expect(
      applyTemplate(client, { userId: 'user-1', templateId: 'template-1', coupleId: 'couple-1' }),
    ).rejects.toSatisfy(isWorkflowReadError);
  });

  it('completeBookedAppointmentSteps throws when the step read fails, rather than completing nothing', async () => {
    const { client } = fakeSupabase(() => failed());
    const booking = {
      ...event,
      event_type: 'consultation_booked',
      payload: { meeting_type_id: 'mt-1', couple_id: 'couple-1' },
    } as unknown as AutomationEventRow;
    await expect(completeBookedAppointmentSteps(client, booking)).rejects.toSatisfy(
      isWorkflowReadError,
    );
  });
});

describe('step context reads', () => {
  it('loadCoupleSnapshot throws on a failed read and still answers null for no couple', async () => {
    const broken = fakeSupabase(() => failed());
    await expect(loadCoupleSnapshot(broken.client, 'couple-1')).rejects.toThrow();

    const empty = fakeSupabase(() => ({ data: null }));
    await expect(loadCoupleSnapshot(empty.client, 'couple-1')).resolves.toBeNull();
  });

  it('loadMcSnapshot throws when the MC cannot be read, rather than sending as "Your business"', async () => {
    const client = {
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: null }, error: { message: 'connection reset' } }),
        },
      },
    } as unknown as Parameters<typeof loadMcSnapshot>[0];
    await expect(loadMcSnapshot(client, 'user-1')).rejects.toThrow();
  });
});

describe('heartbeat reads', () => {
  it('readHeartbeat throws on a failed read, rather than reporting a tick that never ran', async () => {
    const { client } = fakeSupabase(() => failed());
    await expect(readHeartbeat(client, 'automations-tick')).rejects.toThrow();
  });
});

describe('emitter reads', () => {
  it('invoice_due throws when the stage counts cannot be read, rather than calling every stage final', async () => {
    const stage = {
      id: 'stage-1',
      invoice_id: 'invoice-1',
      position: 1,
      label: 'Deposit',
      amount_cents: 1000,
      due_date: '2026-09-29',
      invoices: { id: 'invoice-1', user_id: 'user-1', couple_id: 'couple-1', invoice_number: 'INV-1', subtotal: 10, status: 'sent' },
    };
    const { client } = fakeSupabase((table, calls) => {
      if (table === 'workflow_templates') {
        return { data: [{ user_id: 'user-1', apply_rule_config: { triggerConfig: { days: 3 } } }] };
      }
      if (table === 'invoice_payment_stages' && called(calls, 'in')) return failed();
      if (table === 'invoice_payment_stages') return { data: [stage] };
      return { data: [] };
    });
    await expect(invoiceDueEmitter.run(client, {} as never)).rejects.toThrow();
  });
});
