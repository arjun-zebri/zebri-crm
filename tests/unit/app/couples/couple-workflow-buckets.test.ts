/**
 * How a couple's steps split into what needs a person and what is next.
 *
 * The tab used to render one checklist per applied workflow, headed by
 * the instance name - including the auto-created "General" bucket the
 * MC never made. The split, and the fact that a default instance
 * contributes no workflow name, is the whole of that rebuild, so it is
 * pinned here.
 */
import { describe, expect, it } from 'vitest';

import { bucketCoupleSteps } from '@/app/(dashboard)/couples/couple-workflow-buckets';
import type {
  StepStatus,
  WorkflowInstanceWithSteps,
  WorkflowStepRow,
} from '@/types/workflows';

const TZ = 'Australia/Sydney';
const NOW = new Date('2026-09-06T02:00:00Z'); // midday in Sydney

function step(id: string, overrides: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id,
    instance_id: 'inst-1',
    template_step_id: null,
    position: 0,
    type: 'todo',
    config: {},
    title: id,
    description: null,
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    status: 'pending' as StepStatus,
    requires_approval: false,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function instance(
  steps: WorkflowStepRow[],
  overrides: Partial<WorkflowInstanceWithSteps> = {},
): WorkflowInstanceWithSteps {
  return {
    id: 'inst-1',
    user_id: 'user-1',
    couple_id: 'couple-1',
    template_id: 'tpl-1',
    name: 'Booking flow',
    template_version: 1,
    status: 'active',
    is_default: false,
    is_personal: false,
    trigger_event_id: null,
    context: {},
    applied_at: '2026-09-01T00:00:00Z',
    completed_at: null,
    error_message: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    steps,
    ...overrides,
  };
}

describe('bucketCoupleSteps', () => {
  it('puts overdue, failed and held work in front of the MC', () => {
    const buckets = bucketCoupleSteps(
      [
        instance([
          step('overdue', { due_at: '2026-09-01T02:00:00Z' }),
          step('failed', { status: 'errored' }),
          step('held', {
            type: 'action',
            requires_approval: true,
            due_at: '2026-09-06T01:00:00Z',
          }),
          step('later', { due_at: '2026-09-20T02:00:00Z' }),
        ]),
      ],
      TZ,
      NOW,
    );

    // Dated first, in date order; the undated failure sits after them.
    expect(buckets.needsYouNow.map((r) => r.step.id)).toEqual([
      'overdue',
      'held',
      'failed',
    ]);
    expect(buckets.next.map((r) => r.step.id)).toEqual(['later']);
  });

  it('never names the default instance, so "General" is not a heading', () => {
    const buckets = bucketCoupleSteps(
      [
        instance([step('loose')], {
          id: 'inst-default',
          name: 'General',
          is_default: true,
          template_id: null,
        }),
      ],
      TZ,
      NOW,
    );

    expect(buckets.next[0]?.workflowName).toBeNull();
    // Nothing to stop: the MC never started it.
    expect(buckets.next[0]?.canStop).toBe(false);
  });

  it('names a workflow the MC did start, and offers to stop it', () => {
    const buckets = bucketCoupleSteps([instance([step('a')])], TZ, NOW);
    expect(buckets.next[0]?.workflowName).toBe('Booking flow');
    expect(buckets.next[0]?.canStop).toBe(true);
  });

  it('merges every instance into one list, soonest first, undated last', () => {
    const buckets = bucketCoupleSteps(
      [
        instance([
          step('no-date'),
          step('late', { due_at: '2026-09-20T02:00:00Z' }),
        ]),
        instance([step('soon', { due_at: '2026-09-08T02:00:00Z' })], {
          id: 'inst-2',
          name: 'Run sheet',
        }),
      ],
      TZ,
      NOW,
    );

    expect(buckets.next.map((r) => r.step.id)).toEqual(['soon', 'late', 'no-date']);
  });

  it('takes finished work out of the list, most recent first', () => {
    const buckets = bucketCoupleSteps(
      [
        instance([
          step('done-old', { status: 'done', completed_at: '2026-09-02T00:00:00Z' }),
          step('skipped', { status: 'skipped', completed_at: '2026-09-05T00:00:00Z' }),
          step('open'),
        ]),
      ],
      TZ,
      NOW,
    );

    expect(buckets.done.map((r) => r.step.id)).toEqual(['skipped', 'done-old']);
    expect(buckets.next.map((r) => r.step.id)).toEqual(['open']);
  });

  it('does not call a step due later today overdue', () => {
    // 23:00 Sydney is still today; a UTC comparison would call it
    // tomorrow's work and drop it out of the MC's day.
    const buckets = bucketCoupleSteps(
      [instance([step('tonight', { due_at: '2026-09-06T13:00:00Z' })])],
      TZ,
      NOW,
    );
    expect(buckets.needsYouNow).toHaveLength(0);
    expect(buckets.next.map((r) => r.step.id)).toEqual(['tonight']);
  });
});
