/**
 * Which stopped or paused workflows can be put back into play.
 *
 * The same rule decides the server's refusal and whether the couple tab
 * offers Resume at all, so the MC is never shown a button the server
 * will refuse, or a reason the server does not give.
 */
import { describe, expect, it } from 'vitest';

import { hasLiveTwin, resumeRefusal } from '@/lib/workflows/resume-eligibility';

const LIVE = {
  status: 'cancelled',
  paused_reason: null,
  cancelled_reason: 'manual',
  template_id: 'tpl-1',
  template_status: 'active',
} as const;

describe('resumeRefusal', () => {
  it('allows a workflow the MC stopped', () => {
    expect(resumeRefusal(LIVE)).toBeNull();
  });

  it('allows a workflow the MC paused, or that Turn off paused', () => {
    expect(resumeRefusal({ ...LIVE, status: 'paused', paused_reason: 'manual', cancelled_reason: null })).toBeNull();
    expect(
      resumeRefusal({ ...LIVE, status: 'paused', paused_reason: 'template_off', cancelled_reason: null }),
    ).toBeNull();
  });

  it('allows an old stop with no reason recorded, when its workflow still exists', () => {
    expect(resumeRefusal({ ...LIVE, cancelled_reason: null })).toBeNull();
  });

  it('refuses a setup that did not finish: its steps may be incomplete', () => {
    expect(resumeRefusal({ ...LIVE, cancelled_reason: 'setup_interrupted' })).toMatch(/setup/i);
  });

  it('refuses a workflow that was deleted', () => {
    expect(
      resumeRefusal({ ...LIVE, cancelled_reason: 'template_deleted', template_id: null }),
    ).toMatch(/deleted/i);
  });

  it('refuses a paused workflow that is still being set up', () => {
    expect(
      resumeRefusal({ ...LIVE, status: 'paused', paused_reason: null, cancelled_reason: null }),
    ).toMatch(/set up/i);
  });

  it('refuses a workflow that is running or finished', () => {
    for (const status of ['active', 'completed']) {
      expect(resumeRefusal({ ...LIVE, status, cancelled_reason: null })).not.toBeNull();
    }
  });

  it('refuses any stop whose workflow is gone, whatever the stop\'s reason', () => {
    // Stopped by hand, then the workflow deleted: the delete sweeps only
    // running and paused couples, so this one keeps `manual`.
    expect(resumeRefusal({ ...LIVE, template_id: null, template_status: null })).toMatch(/deleted/i);
    expect(
      resumeRefusal({ ...LIVE, cancelled_reason: null, template_id: null, template_status: null }),
    ).toMatch(/deleted/i);
  });

  it('refuses while the workflow is turned off, paused or stopped', () => {
    expect(resumeRefusal({ ...LIVE, template_status: 'draft' })).toMatch(/turn this workflow on first/i);
    expect(
      resumeRefusal({
        ...LIVE,
        status: 'paused',
        paused_reason: 'template_off',
        cancelled_reason: null,
        template_status: 'archived',
      }),
    ).toMatch(/turn this workflow on first/i);
  });
});

describe('hasLiveTwin', () => {
  const stopped = { id: 'a', couple_id: 'c1', dedupe_key: 'tpl-1', status: 'cancelled' };

  it('finds another live enrolment of the same workflow on the same couple', () => {
    expect(hasLiveTwin(stopped, [stopped, { ...stopped, id: 'b', status: 'active' }])).toBe(true);
    expect(hasLiveTwin(stopped, [{ ...stopped, id: 'b', status: 'paused' }])).toBe(true);
  });

  it('ignores other stops, other couples, other workflows, and a stop with no key', () => {
    expect(hasLiveTwin(stopped, [{ ...stopped, id: 'b' }])).toBe(false);
    expect(hasLiveTwin(stopped, [{ ...stopped, id: 'b', status: 'active', couple_id: 'c2' }])).toBe(false);
    expect(hasLiveTwin(stopped, [{ ...stopped, id: 'b', status: 'active', dedupe_key: 'tpl-2' }])).toBe(false);
    expect(
      hasLiveTwin({ ...stopped, dedupe_key: null }, [{ ...stopped, id: 'b', status: 'active', dedupe_key: null }]),
    ).toBe(false);
  });
});

describe('resumeRefusal, an exit-rule stop', () => {
  it('allows resuming a workflow an exit rule stopped, as an explicit act of the MC', () => {
    expect(resumeRefusal({ ...LIVE, cancelled_reason: 'exit_rule' })).toBeNull();
  });
});
