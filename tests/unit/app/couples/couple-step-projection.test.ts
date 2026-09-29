/**
 * The couple tab says when every coming step will run, not just the
 * one the engine has already dated (user ticket, 2026-09-29: "the
 * 6 month check in doesn't say when it will send, it just says Wait
 * above it with Today next to it").
 */
import { describe, expect, it } from 'vitest';

import { coupleDueLabel } from '@/app/(dashboard)/couples/couple-due-label';
import { projectCoupleSteps } from '@/app/(dashboard)/couples/couple-step-projection';
import type {
  StepTiming,
  WorkflowInstanceWithSteps,
  WorkflowStepRow,
} from '@/types/workflows';

const TZ = 'Australia/Sydney';
const NOW = new Date('2026-09-29T00:00:00Z');
const APPLIED = '2026-09-28T23:00:00.000Z';
const CHAINED: StepTiming = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
const SIX_MONTHS = 182 * 24 * 60;

function step(over: Partial<WorkflowStepRow>): WorkflowStepRow {
  return {
    id: 's',
    instance_id: 'i1',
    template_step_id: null,
    position: 0,
    type: 'action',
    config: { actionType: 'send_email', subject: '6 Month Check In!' },
    title: '',
    description: null,
    timing: CHAINED,
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    status: 'pending',
    completed_at: null,
    requires_approval: false,
    ...over,
  } as WorkflowStepRow;
}

function instance(
  steps: WorkflowStepRow[],
  over: Partial<WorkflowInstanceWithSteps> = {},
): WorkflowInstanceWithSteps {
  return {
    id: 'i1',
    name: 'Couple Booked',
    status: 'active',
    is_default: false,
    is_personal: false,
    template_id: 't1',
    couple_id: 'c1',
    applied_at: APPLIED,
    steps,
    ...over,
  } as WorkflowInstanceWithSteps;
}

/** The ticket's workflow: wait, send (held for OK), wait, send. */
function ticketWorkflow(): WorkflowStepRow[] {
  return [
    step({
      id: 'wait1',
      position: 100,
      type: 'wait',
      config: { mode: 'duration', durationMinutes: SIX_MONTHS },
      due_at: APPLIED,
    }),
    step({ id: 'send1', position: 200, requires_approval: true }),
    step({
      id: 'wait2',
      position: 300,
      type: 'wait',
      config: { mode: 'duration', durationMinutes: SIX_MONTHS },
    }),
    step({ id: 'send2', position: 400, requires_approval: true }),
  ];
}

describe('projectCoupleSteps', () => {
  it('dates the send behind a wait that has not started yet', () => {
    const steps = ticketWorkflow();
    const out = projectCoupleSteps([instance(steps)], null, TZ, NOW);
    expect(coupleDueLabel(steps[1]!, TZ, NOW, out.get('send1'))).toBe('2027-03-30');
  });

  it('says when a wait ends rather than when it started', () => {
    const steps = ticketWorkflow();
    const out = projectCoupleSteps([instance(steps)], null, TZ, NOW);
    expect(coupleDueLabel(steps[0]!, TZ, NOW, out.get('wait1'))).toBe('Until 2027-03-30');
  });

  it('names the approval the rest of the workflow is waiting on', () => {
    const steps = ticketWorkflow();
    const out = projectCoupleSteps([instance(steps)], null, TZ, NOW);
    expect(coupleDueLabel(steps[3]!, TZ, NOW, out.get('send2'))).toBe(
      'After you OK Send email · 6 Month Check In!',
    );
  });

  it('leaves a paused workflow on its stored dates: nothing runs while paused', () => {
    const steps = ticketWorkflow();
    const out = projectCoupleSteps([instance(steps, { status: 'paused' })], null, TZ, NOW);
    expect(out.size).toBe(0);
    expect(coupleDueLabel(steps[1]!, TZ, NOW, out.get('send1'))).toBe('');
  });

  it('leaves the couple’s own to-do list alone: it is not a sequence', () => {
    const todo = step({ id: 'todo', type: 'todo', title: 'Call', due_at: '2026-10-05T00:00:00Z' });
    const out = projectCoupleSteps([instance([todo], { is_default: true })], null, TZ, NOW);
    expect(out.size).toBe(0);
    expect(coupleDueLabel(todo, TZ, NOW, out.get('todo'))).toBe('2026-10-05');
  });
});

describe('coupleDueLabel with a projection', () => {
  it('still says Failed for a failed step', () => {
    const failed = step({ status: 'errored' });
    expect(coupleDueLabel(failed, TZ, NOW, { at: null, gate: 'x' })).toBe('Failed');
  });

  it('a wait ending today reads "Until today"', () => {
    const w = step({ type: 'wait' });
    expect(coupleDueLabel(w, TZ, NOW, { at: NOW.toISOString(), gate: null })).toBe('Until today');
  });
});

describe('coupleDueLabel keeps what it said before for a dated step', () => {
  it('an overdue automated send still reads Overdue, not Today', () => {
    const late = step({ id: 'late', due_at: '2026-09-01T00:00:00Z' });
    const out = projectCoupleSteps([instance([late])], null, TZ, NOW);
    expect(out.get('late')?.at).toBe(NOW.toISOString());
    expect(coupleDueLabel(late, TZ, NOW, out.get('late'))).toBe('Overdue · 2026-09-01');
  });

  it('a dated to-do keeps its own date', () => {
    const todo = step({ id: 'todo', type: 'todo', title: 'Call', due_at: '2026-10-05T00:00:00Z' });
    const out = projectCoupleSteps([instance([todo])], null, TZ, NOW);
    expect(coupleDueLabel(todo, TZ, NOW, out.get('todo'))).toBe('2026-10-05');
  });
});
