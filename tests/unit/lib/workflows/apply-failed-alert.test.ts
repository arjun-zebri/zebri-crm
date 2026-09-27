/**
 * An apply that fails after its instance exists is not silent (Task 36
 * fix round 1, the implementer's concern 2).
 *
 * `applyTemplate` cancels the half-built instance (`setup_interrupted`,
 * which the couple's Stopped strip shows with "Start it again instead"),
 * and the dispatcher marks the event handled: a retry would hit the
 * per-event unique index. So the only way anyone hears is this alert,
 * ids only, deduped per workflow.
 *
 * @module tests/unit/lib/workflows/apply-failed-alert.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

import { sendAlert } from '@/lib/alerts/send-alert';
import { _resetApplyFailedAlertDedupForTest, applyTemplate } from '@/lib/workflows/instantiate';

import { called, failed, fakeSupabase } from './fake-supabase';

/** Everything works until the template's steps are read. */
function db() {
  return fakeSupabase((table, calls) => {
    if (table === 'workflow_templates') {
      return { data: { id: 'template-1', status: 'active', allow_reapply: true, name: 'Enquiry', version: 1 } };
    }
    if (table === 'user_public_settings') return { data: { timezone: 'Australia/Sydney' } };
    if (table === 'workflow_instances' && called(calls, 'insert')) {
      return { data: { id: 'instance-1', user_id: 'user-1', couple_id: 'couple-1' } };
    }
    if (table === 'workflow_instances' && called(calls, 'update')) return { data: [{ id: 'instance-1' }] };
    if (table === 'workflow_template_steps') return failed();
    return { data: null };
  });
}

describe('workflow_apply_failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetApplyFailedAlertDedupForTest();
  });

  it('alerts with ids only when an apply fails after its instance was created', async () => {
    const result = await applyTemplate(db().client, {
      userId: 'user-1',
      templateId: 'template-1',
      coupleId: 'couple-1',
      triggerEventId: 'event-1',
    });

    expect('error' in result).toBe(true);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith({
      type: 'workflow_apply_failed',
      severity: 'error',
      userId: 'user-1',
      templateId: 'template-1',
      coupleId: 'couple-1',
      instanceId: 'instance-1',
      triggerEventId: 'event-1',
    });
  });

  it('dedupes per workflow', async () => {
    const opts = { userId: 'user-1', templateId: 'template-1', coupleId: 'couple-1' };
    await applyTemplate(db().client, opts);
    await applyTemplate(db().client, opts);
    expect(vi.mocked(sendAlert).mock.calls.filter(([e]) => e.type === 'workflow_apply_failed')).toHaveLength(1);
  });
});
