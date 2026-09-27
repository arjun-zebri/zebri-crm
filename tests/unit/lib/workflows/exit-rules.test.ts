/**
 * The save-time rules for a workflow's exit stages (Phase 3, Task 21).
 *
 * A workflow that starts when a couple moves to a stage cannot also stop
 * then: the dispatcher runs exits before applies, so the couple would be
 * stopped and restarted from the top on every such move.
 */
import { describe, expect, it } from 'vitest';

import {
  applyStage,
  exitRuleConflict,
  isOwnExitStage,
  normaliseExitStatuses,
} from '@/lib/workflows/exit-rules';

const builderRule = (toStatus?: string) => ({
  applyRuleType: 'on_event',
  applyRuleConfig: {
    eventType: 'couple_stage_changed',
    triggerConfig: toStatus === undefined ? {} : { toStatus },
  },
});
const names: Record<string, string> = { lost: 'Lost', confirmed: 'Booked' };
const nameFor = (slug: string) => names[slug] ?? slug;

describe('normaliseExitStatuses', () => {
  it('trims, lower-cases, drops blanks and repeats, and keeps the order', () => {
    expect(normaliseExitStatuses([' Lost', 'confirmed', '', 'LOST', 'confirmed '])).toEqual([
      'lost',
      'confirmed',
    ]);
  });
});

describe('applyStage', () => {
  it('reads the builder form and the native rule alike', () => {
    expect(applyStage('on_event', builderRule('Lost').applyRuleConfig)).toBe('lost');
    expect(applyStage('on_stage_changed', { toStatus: 'lost' })).toBe('lost');
  });

  it('reads a builder stage trigger with no stage as any stage, and a blank native rule as none', () => {
    expect(applyStage('on_event', builderRule().applyRuleConfig)).toBe('*');
    expect(applyStage('on_stage_changed', {})).toBeNull();
  });

  it('is null for rules that never start on a stage change', () => {
    expect(applyStage('manual', {})).toBeNull();
    expect(applyStage('on_couple_created', {})).toBeNull();
    expect(applyStage('on_event', { eventType: 'new_enquiry', triggerConfig: { toStatus: 'lost' } })).toBeNull();
  });
});

describe('exitRuleConflict', () => {
  it('refuses a workflow that starts and stops on the same stage, in plain words', () => {
    expect(exitRuleConflict(builderRule('lost'), ['confirmed', 'lost'], nameFor)).toBe(
      'This workflow starts when a couple moves to Lost, so it cannot also stop then. ' +
        'Remove Lost from the stop stages, or change what starts it.',
    );
  });

  it('refuses the native rule the same way, whatever the case', () => {
    expect(
      exitRuleConflict({ applyRuleType: 'on_stage_changed', applyRuleConfig: { toStatus: 'Lost' } }, ['LOST']),
    ).toMatch(/starts when a couple moves to lost/);
  });

  it('allows stop stages on a workflow whose stage trigger has no stage chosen yet', () => {
    // The picker seeds a blank stage; refusing it would leave the MC no
    // way to pick one. The dispatcher skips the exit stages at match time.
    expect(exitRuleConflict(builderRule(''), ['lost'], nameFor)).toBeNull();
    expect(exitRuleConflict(builderRule(), ['lost'], nameFor)).toBeNull();
  });

  it('allows stop stages the workflow does not start on', () => {
    expect(exitRuleConflict(builderRule('confirmed'), ['lost'], nameFor)).toBeNull();
  });

  it('allows any rule when there are no stop stages', () => {
    expect(exitRuleConflict(builderRule(''), [], nameFor)).toBeNull();
    expect(exitRuleConflict(builderRule('lost'), [' '], nameFor)).toBeNull();
  });

  it('allows stop stages on a workflow that is not started by a stage change', () => {
    expect(exitRuleConflict({ applyRuleType: 'manual', applyRuleConfig: {} }, ['lost'])).toBeNull();
    expect(
      exitRuleConflict({ applyRuleType: 'on_couple_created', applyRuleConfig: {} }, ['lost']),
    ).toBeNull();
  });
});

describe('isOwnExitStage', () => {
  const event = (to_status: unknown, event_type = 'couple_stage_changed') => ({
    event_type,
    payload: { to_status },
  });

  it('is true when a stage change lands on one of the workflow exit stages, whatever the case', () => {
    expect(isOwnExitStage(event('Lost'), ['lost'])).toBe(true);
  });

  it('is false for another stage, another event, no exit stages, or no stage', () => {
    expect(isOwnExitStage(event('contacted'), ['lost'])).toBe(false);
    expect(isOwnExitStage(event('lost', 'new_enquiry'), ['lost'])).toBe(false);
    expect(isOwnExitStage(event('lost'), [])).toBe(false);
    expect(isOwnExitStage(event(null), ['lost'])).toBe(false);
  });
});
