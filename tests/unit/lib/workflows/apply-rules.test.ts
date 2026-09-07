import { describe, expect, it } from 'vitest';

import {
  getApplyRuleSpec,
  joinApplyRule,
  splitApplyRule,
} from '@/lib/workflows/apply-rules';
import type { AutomationEventRow, TriggerType } from '@/types/automations';

/** Minimal bus event, widened per case. */
function event(over: Partial<AutomationEventRow>): AutomationEventRow {
  return {
    id: 'e1',
    user_id: 'u1',
    source_table: 'couples',
    source_id: 'c1',
    event_type: 'new_enquiry' as TriggerType,
    payload: {},
    couple_id: 'c1',
    created_at: '2026-09-04T00:00:00Z',
    processed_at: null,
    error_message: null,
    ...over,
  } as AutomationEventRow;
}

describe('apply rules', () => {
  it('manual never matches an event', () => {
    const spec = getApplyRuleSpec('manual')!;
    expect(spec.matchesRaw(event({}), {})).toBe(false);
  });

  it('on_couple_created matches the existing new_enquiry emit', () => {
    // Couple INSERT already emits `new_enquiry` (20260604000100). We match
    // that slug rather than adding a second event for the same row change.
    const spec = getApplyRuleSpec('on_couple_created')!;
    expect(spec.matchesRaw(event({ event_type: 'new_enquiry' as TriggerType }), {})).toBe(true);
    expect(spec.matchesRaw(event({ event_type: 'contract_signed' as TriggerType }), {})).toBe(false);
  });

  it('on_stage_changed matches the configured destination status', () => {
    const spec = getApplyRuleSpec('on_stage_changed')!;
    const e = event({
      event_type: 'couple_stage_changed' as TriggerType,
      payload: { to_status: 'Booked' },
    });
    expect(spec.matchesRaw(e, { toStatus: 'Booked' })).toBe(true);
    expect(spec.matchesRaw(e, { toStatus: 'Enquiry' })).toBe(false);
  });

  it('on_stage_changed compares case-insensitively', () => {
    // Couple statuses are user-defined free text. An MC who renames
    // "booked" to "Booked" must not silently kill their workflow.
    const spec = getApplyRuleSpec('on_stage_changed')!;
    const e = event({
      event_type: 'couple_stage_changed' as TriggerType,
      payload: { to_status: 'booked' },
    });
    expect(spec.matchesRaw(e, { toStatus: 'Booked' })).toBe(true);
  });

  it('on_stage_changed with no configured status matches nothing', () => {
    // An unconfigured rule must not fire on every stage change.
    const spec = getApplyRuleSpec('on_stage_changed')!;
    const e = event({
      event_type: 'couple_stage_changed' as TriggerType,
      payload: { to_status: 'Booked' },
    });
    expect(spec.matchesRaw(e, {})).toBe(false);
  });

  it('on_package_applied matches any package when none is configured', () => {
    const spec = getApplyRuleSpec('on_package_applied')!;
    const e = event({
      event_type: 'package_applied' as TriggerType,
      payload: { package_id: 'p1' },
    });
    expect(spec.matchesRaw(e, {})).toBe(true);
  });

  it('on_package_applied narrows to the configured package', () => {
    const spec = getApplyRuleSpec('on_package_applied')!;
    const e = event({
      event_type: 'package_applied' as TriggerType,
      payload: { package_id: '11111111-1111-4111-8111-111111111111' },
    });
    expect(
      spec.matchesRaw(e, { packageId: '11111111-1111-4111-8111-111111111111' }),
    ).toBe(true);
    expect(
      spec.matchesRaw(e, { packageId: '22222222-2222-4222-8222-222222222222' }),
    ).toBe(false);
  });

  it('on_event delegates to the existing trigger registry', () => {
    const spec = getApplyRuleSpec('on_event')!;
    const e = event({ event_type: 'contract_signed' as TriggerType, payload: {} });
    const cfg = { eventType: 'contract_signed', triggerConfig: {} };
    expect(spec.matchesRaw(e, cfg)).toBe(true);
    expect(spec.matchesRaw(event({ event_type: 'new_enquiry' as TriggerType }), cfg)).toBe(false);
  });

  it('on_event with an unknown event type matches nothing', () => {
    const spec = getApplyRuleSpec('on_event')!;
    const cfg = { eventType: 'not_a_real_trigger', triggerConfig: {} };
    expect(spec.matchesRaw(event({ event_type: 'not_a_real_trigger' as TriggerType }), cfg)).toBe(false);
  });

  it('an unknown rule slug has no spec', () => {
    expect(getApplyRuleSpec('nonsense')).toBeNull();
  });

  it('every registry entry parses an empty config without throwing', () => {
    // A rule whose schema rejects {} is a dead rule: the dispatcher
    // re-parses config on every event and a rejected config silently
    // never matches. Same failure mode the trigger sweep found.
    for (const type of [
      'manual',
      'on_couple_created',
      'on_stage_changed',
      'on_package_applied',
      'on_event',
    ] as const) {
      const spec = getApplyRuleSpec(type)!;
      expect(spec.parseConfig({})).not.toBeNull();
    }
  });
});

describe('the apply-rule adapter', () => {
  it('stores a picked trigger as on_event nesting its own config', () => {
    // The CHECK constraint has no `new_enquiry` member, so a raw trigger
    // slug would fail the write. This is the bug the builder shipped with:
    // picking a rule looked fine until a reload showed the placeholder.
    expect(joinApplyRule('new_enquiry', { leadSource: 'Instagram' })).toEqual({
      applyRuleType: 'on_event',
      applyRuleConfig: {
        eventType: 'new_enquiry',
        triggerConfig: { leadSource: 'Instagram' },
      },
    });
  });

  it('stores the canvas placeholder as the manual rule', () => {
    expect(joinApplyRule('unset', { stale: true })).toEqual({
      applyRuleType: 'manual',
      applyRuleConfig: {},
    });
  });

  it('round-trips a trigger through store and read', () => {
    const stored = joinApplyRule('couple_stage_changed', { toStatus: 'Booked' });
    expect(splitApplyRule(stored.applyRuleType, stored.applyRuleConfig)).toEqual({
      triggerType: 'couple_stage_changed',
      triggerConfig: { toStatus: 'Booked' },
    });
  });

  it('reads the manual rule back as the canvas placeholder', () => {
    expect(splitApplyRule('manual', {})).toEqual({
      triggerType: 'unset',
      triggerConfig: {},
    });
  });

  it('reads a native rule back as its equivalent trigger', () => {
    // The three native rules predate the builder. Their config keys match
    // their trigger counterparts, so the canvas can edit them in place.
    expect(splitApplyRule('on_couple_created', {})).toEqual({
      triggerType: 'new_enquiry',
      triggerConfig: {},
    });
    expect(splitApplyRule('on_stage_changed', { toStatus: 'Booked' })).toEqual({
      triggerType: 'couple_stage_changed',
      triggerConfig: { toStatus: 'Booked' },
    });
    expect(splitApplyRule('on_package_applied', { packageId: 'p1' })).toEqual({
      triggerType: 'package_applied',
      triggerConfig: { packageId: 'p1' },
    });
  });

  it('reads an on_event rule with no event type as unset', () => {
    // A half-written config must not title a card with an empty slug.
    expect(splitApplyRule('on_event', { triggerConfig: {} })).toEqual({
      triggerType: 'unset',
      triggerConfig: {},
    });
  });

  it('reads a rule slug the canvas has no word for as unset', () => {
    expect(splitApplyRule('on_something_new', { a: 1 })).toEqual({
      triggerType: 'unset',
      triggerConfig: {},
    });
  });
});
