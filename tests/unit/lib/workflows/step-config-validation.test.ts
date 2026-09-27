/**
 * Save-time step config validation (Task 33).
 *
 * The helper is the runner's own parse, run before the write: a config
 * it rejects is one the send would have errored on later, so the MC is
 * told at save. The field clause is the send's own; the closing asks
 * for a fix before saving (review I3).
 *
 * @module tests/unit/lib/workflows/step-config-validation.test
 */
import { describe, expect, it } from 'vitest';

import { validateStepConfig } from '@/lib/workflows/step-config-validation';

const RECIPIENTS = { roles: ['primary'], fallback: 'primary_only' };

describe('validateStepConfig', () => {
  it('rejects a send with its subject blanked, asking for a fix before saving', () => {
    const res = validateStepConfig('action', {
      actionType: 'send_email',
      recipients: RECIPIENTS,
      subject: '',
      body: 'Hi',
    });
    expect(res).toEqual({
      ok: false,
      error: 'The "Send email" step has invalid settings: Subject is required. Fix this before saving.',
      // Since the Phase 6 wave the verdict also says why, structurally.
      reason: 'invalid',
    });
  });

  it('accepts a complete send', () => {
    expect(
      validateStepConfig('action', {
        actionType: 'send_email',
        recipients: RECIPIENTS,
        subject: 'Hello',
        body: 'Hi',
      }),
    ).toEqual({ ok: true });
  });

  it('rejects a stage move with no stage chosen', () => {
    const res = validateStepConfig('action', { actionType: 'update_couple_stage', toStatus: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(
      'The "Update couple stage" step has invalid settings: To status is required. Fix this before saving.',
    );
  });

  it('accepts a stage move with a stage', () => {
    expect(validateStepConfig('action', { actionType: 'update_couple_stage', toStatus: 'booked' })).toEqual({ ok: true });
  });

  it('rejects a branch with no condition, as the runner would', () => {
    const res = validateStepConfig('branch', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('The "Branch" step has invalid settings: no condition chosen');
  });

  it('checks a wait against the wait schema', () => {
    expect(validateStepConfig('wait', { mode: 'duration', durationMinutes: 60 })).toEqual({ ok: true });
    expect(validateStepConfig('wait', { mode: 'sometime' }).ok).toBe(false);
  });

  it('leaves manual steps alone: the runner never parses them', () => {
    expect(validateStepConfig('todo', {})).toEqual({ ok: true });
    expect(validateStepConfig('appointment', { anything: 1 })).toEqual({ ok: true });
  });

  it('rejects an action step with no action, or one Zebri cannot run', () => {
    expect(validateStepConfig('action', {}).ok).toBe(false);
    const unknown = validateStepConfig('action', { actionType: 'stop' });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).not.toMatch(/stop|unknown action/);
  });

  it('rejects a step type the engine does not know', () => {
    expect(validateStepConfig('teleport', {}).ok).toBe(false);
  });

  it('says why in a structured reason, so a caller never parses the sentence (Task 34 re-review Minor 7)', () => {
    expect(validateStepConfig('action', {})).toMatchObject({ ok: false, reason: 'no_action' });
    expect(validateStepConfig('action', { actionType: 'nope' })).toMatchObject({ ok: false, reason: 'not_runnable' });
    expect(validateStepConfig('teleport', {})).toMatchObject({ ok: false, reason: 'not_runnable' });
    expect(validateStepConfig('branch', {})).toMatchObject({ ok: false, reason: 'invalid' });
    expect(validateStepConfig('action', { actionType: 'stop' })).toMatchObject({ ok: false, reason: 'removed' });
  });

  it('treats a null config as empty', () => {
    expect(validateStepConfig('todo', null)).toEqual({ ok: true });
    expect(validateStepConfig('branch', null).ok).toBe(false);
  });
});
