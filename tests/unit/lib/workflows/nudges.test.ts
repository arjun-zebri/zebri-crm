import { describe, expect, it } from 'vitest';

import { detectNudges, type NudgeFacts, type NudgeStep } from '@/lib/workflows/nudges';
import { DEFAULT_STEP_TIMING } from '@/types/workflows';

const TODAY = '2026-09-10';

function step(over: Partial<NudgeStep> = {}): NudgeStep {
  return {
    title: 'A step',
    type: 'todo',
    status: 'pending',
    dueAt: null,
    requiresApproval: false,
    timing: DEFAULT_STEP_TIMING,
    ...over,
  };
}

function facts(over: Partial<NudgeFacts> = {}): NudgeFacts {
  return {
    weddingDate: null,
    todayLocal: TODAY,
    steps: [],
    hasActiveWorkflow: true,
    ...over,
  };
}

/** The ids of every nudge produced, in order. */
function ids(over: Partial<NudgeFacts>): string[] {
  return detectNudges(facts(over)).map((n) => n.id);
}

describe('detectNudges', () => {
  it('says nothing when everything is fine', () => {
    // An empty array is the good case. A permanent banner saying "all
    // good" is noise the MC learns to look past.
    expect(
      ids({ steps: [step({ dueAt: '2026-12-01T00:00:00Z' })], weddingDate: '2027-01-01' }),
    ).toEqual([]);
  });

  it('leads with a failure', () => {
    const out = detectNudges(
      facts({
        steps: [
          step({ title: 'Send the invoice', type: 'action', status: 'errored' }),
          step({ dueAt: '2026-09-01T00:00:00Z' }),
        ],
      }),
    );
    expect(out[0]?.id).toBe('errored');
    expect(out[0]?.tone).toBe('danger');
    expect(out[0]?.message).toContain('Send the invoice');
  });

  it('counts held sends waiting for the MC', () => {
    const out = detectNudges(
      facts({
        steps: [
          step({ type: 'action', requiresApproval: true, dueAt: '2026-09-09T00:00:00Z' }),
          step({ type: 'action', requiresApproval: true, dueAt: '2026-09-10T00:00:00Z' }),
        ],
      }),
    );
    expect(out.find((n) => n.id === 'review')?.message).toContain('2 messages');
  });

  it('does not count a held send that is not due yet', () => {
    expect(
      ids({
        steps: [
          step({ type: 'action', requiresApproval: true, dueAt: '2026-10-01T00:00:00Z' }),
        ],
      }),
    ).not.toContain('review');
  });

  it('warns when steps are anchored to a wedding date nobody has set', () => {
    // The quietest failure in the engine: a wedding-relative step with
    // no date never gets a due date, so it silently never happens.
    const out = detectNudges(
      facts({
        weddingDate: null,
        steps: [
          step({
            timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
          }),
        ],
      }),
    );
    expect(out.find((n) => n.id === 'no-wedding-date')?.message).toMatch(/not set yet/i);
  });

  it('does not warn about the wedding date once there is one', () => {
    expect(
      ids({
        weddingDate: '2027-05-01',
        steps: [
          step({
            timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
          }),
        ],
      }),
    ).not.toContain('no-wedding-date');
  });

  it('raises its voice as the wedding gets close', () => {
    const soon = detectNudges(
      facts({ weddingDate: '2026-09-14', steps: [step()] }),
    ).find((n) => n.id === 'wedding-close');
    expect(soon?.tone).toBe('warning');

    const further = detectNudges(
      facts({ weddingDate: '2026-09-28', steps: [step()] }),
    ).find((n) => n.id === 'wedding-close');
    expect(further?.tone).toBe('info');
  });

  it('says nothing about a wedding that has already happened', () => {
    expect(ids({ weddingDate: '2026-09-01', steps: [step()] })).not.toContain('wedding-close');
  });

  it('notices a couple with no process running at all', () => {
    expect(ids({ hasActiveWorkflow: false, steps: [] })).toContain('no-workflow');
  });

  it('does not nag about no workflow when there is work on the list', () => {
    expect(ids({ hasActiveWorkflow: false, steps: [step()] })).not.toContain('no-workflow');
  });
});
