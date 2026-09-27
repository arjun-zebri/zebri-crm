/**
 * `loadMcSnapshot` must not fabricate a quiet-hours window for an MC who
 * never set one. It previously defaulted an unset `quiet_hours_start` /
 * `quiet_hours_end` to '21:00' / '08:00', contradicting the module
 * contract in `lib/automations/quiet-hours.ts` ("both default to 'no
 * quiet hours' when unset") and silently holding an evening "wait 5
 * minutes, then send" until 08:00 the next morning.
 *
 * These tests go through `loadMcSnapshot` itself (not a hand-built
 * `McSnapshot`), because the bug lived in the snapshot builder, not in
 * `resolveQuietHours` downstream of it. A test that hand-constructs a
 * snapshot with nulls already baked in never exercises the fallback and
 * stays green whether or not the bug exists.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { loadMcSnapshot } from '@/lib/automations/context';
import { nextAllowedSendAt, resolveQuietHours } from '@/lib/automations/quiet-hours';

/** Admin double answering `supabase.auth.admin.getUserById` for one user row. */
function adminWithUser(userMetadata: Record<string, unknown>) {
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: 'mc-1', email: 'mc@test.com', user_metadata: userMetadata, app_metadata: {} } },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
}

describe('loadMcSnapshot quiet hours', () => {
  it('resolves to null when the MC never set quiet hours', async () => {
    const supabase = adminWithUser({});
    const snap = await loadMcSnapshot(supabase, 'mc-1');
    expect(snap.quietHoursStart).toBeNull();
    expect(snap.quietHoursEnd).toBeNull();
  });

  it('carries a configured window through unchanged', async () => {
    const supabase = adminWithUser({ quiet_hours_start: '22:00', quiet_hours_end: '07:00' });
    const snap = await loadMcSnapshot(supabase, 'mc-1');
    expect(snap.quietHoursStart).toBe('22:00');
    expect(snap.quietHoursEnd).toBe('07:00');
  });

  /**
   * The reported incident, end to end: an enquiry at half past nine at
   * night, a five minute wait, and a send that must go at 21:35 rather
   * than 08:00 the next morning. Routes through the real snapshot
   * builder and then the same `resolveQuietHours` + `nextAllowedSendAt`
   * chain `applyQuietHours` calls in `lib/workflows/execute-step.ts`.
   */
  it('does not defer an evening wait to the morning', async () => {
    const supabase = adminWithUser({});
    const mc = await loadMcSnapshot(supabase, 'mc-1');

    const wake = new Date('2026-09-22T11:35:00.000Z'); // 21:35 Sydney
    const window = resolveQuietHours(null, null, mc, null);
    const allowed = window ? nextAllowedSendAt(wake, window) : wake;

    expect(allowed.toISOString()).toBe(wake.toISOString());
  });
});
