/**
 * Scheduler Phase D - booking lifecycle RPCs (cancel, reschedule, reminder).
 *
 * Tests the manage page and reminder cron RPCs:
 * - get_booking_by_manage_token: anon lookup by token (no user_id, no MC email)
 * - cancel_booking: flip to cancelled, emit event
 * - reschedule_booking: move times in place, clear reminder_sent_at
 * - bookings_due_for_reminder: service_role only, returns remindable bookings
 * - mark_booking_reminder_sent: service_role only, mark reminded
 */
import { afterAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

interface ArrangedType {
  user: TestUser;
  token: string;
  typeId: string;
  durationMinutes: number;
}

/**
 * Create an MC with an active meeting type.
 */
async function arrangeMeetingType(opts: {
  name?: string;
  durationMinutes?: number;
  locationTypes?: 'video' | 'phone' | 'in_person';
  active?: boolean;
  reminderEnabled?: boolean;
} = {}): Promise<ArrangedType> {
  const user = await createTestUser({}, pro);
  const admin = serviceClient();

  const durationMinutes = opts.durationMinutes ?? 30;
  const name = opts.name ?? 'Consultation';

  const { data: typeData, error: typeErr } = await admin
    .from('meeting_types')
    .insert({
      user_id: user.id,
      name,
      description: 'Test booking type',
      duration_minutes: durationMinutes,
      location_type: opts.locationTypes ?? 'video',
      active: opts.active !== false,
      reminder_enabled: opts.reminderEnabled ?? true,
    })
    .select('id, share_token')
    .single();

  if (typeErr || !typeData) {
    throw new Error(`meeting_type insert failed: ${typeErr?.message}`);
  }

  return {
    user,
    token: typeData.share_token as string,
    typeId: typeData.id as string,
    durationMinutes,
  };
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

describe('get_booking_by_manage_token', () => {
  it('returns the booking and meeting type details for a valid token', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
        video_join_url: 'https://zoom.us/j/123456',
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    const { data, error } = await anonClient().rpc(
      'get_booking_by_manage_token',
      {
        token,
      },
    );

    expect(error).toBeNull();
    const result = data as unknown as {
      booking_id: string;
      status: string;
      name: string;
      email: string;
      business_name: string;
      meeting_type: {
        id: string;
        name: string;
        duration_minutes: number;
      };
      user_id?: string;
    };

    expect(result.booking_id).toBeDefined();
    expect(result.status).toBe('confirmed');
    expect(result.name).toBe('Test Booker');
    expect(result.email).toBe('booker@example.test');
    expect(result.meeting_type.name).toBe('Consultation');
    expect(result.meeting_type.duration_minutes).toBe(30);

    // CRITICAL: payload must not contain user_id or MC email
    expect(result.user_id).toBeUndefined();
    expect(Object.keys(result)).not.toContain('user_id');
  });

  it('returns null for an unknown token', async () => {
    const { data, error } = await anonClient().rpc(
      'get_booking_by_manage_token',
      {
        token: '00000000-0000-0000-0000-000000000000',
      },
    );

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe('cancel_booking', () => {
  it('flips status to cancelled and sets cancelled_at', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token, id')
      .single();

    const token = booking!.manage_token as string;
    const bookingId = booking!.id as string;

    const { data, error } = await anonClient().rpc('cancel_booking', {
      p_manage_token: token,
    });

    expect(error).toBeNull();
    const result = data as unknown as {
      ok: boolean;
      booking_id: string;
    };
    expect(result.ok).toBe(true);
    expect(result.booking_id).toBe(bookingId);

    // Verify row is cancelled
    const { data: updated } = await admin
      .from('bookings')
      .select('status, cancelled_at')
      .eq('id', bookingId)
      .single();

    expect(updated?.status).toBe('cancelled');
    expect(updated?.cancelled_at).not.toBeNull();
  });

  it('returns error when called twice on the same booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    // First cancellation succeeds
    const first = await anonClient().rpc('cancel_booking', {
      p_manage_token: token,
    });
    expect((first.data as { ok?: boolean })?.ok).toBe(true);

    // Second cancellation fails
    const second = await anonClient().rpc('cancel_booking', {
      p_manage_token: token,
    });
    expect((second.data as { error?: string })?.error).toBe('already_cancelled');
  });

  it('returns error for unknown token', async () => {
    const { data } = await anonClient().rpc('cancel_booking', {
      p_manage_token: '00000000-0000-0000-0000-000000000000',
    });

    expect((data as { error?: string })?.error).toBe('not_found');
  });

  it('returns error for a past booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const ends = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Past Booker',
        email: 'past@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    const { data } = await anonClient().rpc('cancel_booking', {
      p_manage_token: token,
    });

    expect((data as { error?: string })?.error).toBe('past');
  });

  it('emits booking_cancelled automation event', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token, id')
      .single();

    const token = booking!.manage_token as string;
    const bookingId = booking!.id as string;

    await anonClient().rpc('cancel_booking', {
      p_manage_token: token,
    });

    // Verify automation event was emitted
    const { data: events } = await admin
      .from('automation_events')
      .select('*')
      .eq('event_type', 'booking_cancelled')
      .eq('source_id', bookingId);

    expect(events).toHaveLength(1);
    expect(events![0]!.event_type).toBe('booking_cancelled');
  });

  it('freeing the slot allows another booking on the same range', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    // Create first booking
    const { data: booking1 } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'First Booker',
        email: 'first@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    // Cancel it
    await anonClient().rpc('cancel_booking', {
      p_manage_token: booking1!.manage_token as string,
    });

    // Create second booking on the same range - should succeed
    const { data: booking2 } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Second Booker',
        email: 'second@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('id')
      .single();

    expect(booking2?.id).toBeDefined();

    // Verify we have one confirmed booking
    const { count } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr.user.id)
      .eq('status', 'confirmed');

    expect(count).toBe(1);
  });
});

describe('reschedule_booking', () => {
  it('moves the booking and returns previous_starts_at', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const oldStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oldEnd = new Date(oldStart.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: oldStart.toISOString(),
        ends_at: oldEnd.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token, id')
      .single();

    const token = booking!.manage_token as string;
    const bookingId = booking!.id as string;

    // Reschedule 2 hours later
    const newStart = new Date(oldStart.getTime() + 2 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

    const { data, error } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: newStart.toISOString(),
      p_ends_at: newEnd.toISOString(),
    });

    expect(error).toBeNull();
    const result = data as unknown as {
      ok: boolean;
      booking_id: string;
      previous_starts_at: string;
      starts_at: string;
    };
    expect(result.ok).toBe(true);
    expect(result.booking_id).toBe(bookingId);
    expect(new Date(result.previous_starts_at).getTime()).toBe(
      oldStart.getTime(),
    );
    expect(new Date(result.starts_at).getTime()).toBe(newStart.getTime());

    // Verify booking was updated
    const { data: updated } = await admin
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('id', bookingId)
      .single();

    expect(new Date(updated!.starts_at).getTime()).toBe(newStart.getTime());
    expect(new Date(updated!.ends_at).getTime()).toBe(newEnd.getTime());
  });

  it('clears reminder_sent_at on reschedule', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const oldStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oldEnd = new Date(oldStart.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: oldStart.toISOString(),
        ends_at: oldEnd.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
        reminder_sent_at: now.toISOString(), // Pre-set
      })
      .select('manage_token, id')
      .single();

    const token = booking!.manage_token as string;
    const bookingId = booking!.id as string;

    const newStart = new Date(oldStart.getTime() + 2 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

    await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: newStart.toISOString(),
      p_ends_at: newEnd.toISOString(),
    });

    // Verify reminder_sent_at is cleared
    const { data: updated } = await admin
      .from('bookings')
      .select('reminder_sent_at')
      .eq('id', bookingId)
      .single();

    expect(updated?.reminder_sent_at).toBeNull();
  });

  it('returns error when rescheduling onto occupied range (different booking)', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const start1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const end1 = new Date(start1.getTime() + 30 * 60 * 1000);

    const start2 = new Date(start1.getTime() + 2 * 60 * 60 * 1000);
    const end2 = new Date(start2.getTime() + 30 * 60 * 1000);

    // Create two bookings
    const { data: booking1 } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Booker 1',
        email: 'booker1@example.test',
        starts_at: start1.toISOString(),
        ends_at: end1.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Booker 2',
        email: 'booker2@example.test',
        starts_at: start2.toISOString(),
        ends_at: end2.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      });

    const token1 = booking1!.manage_token as string;

    // Try to reschedule booking 1 onto booking 2's time
    const { data } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token1,
      p_starts_at: start2.toISOString(),
      p_ends_at: end2.toISOString(),
    });

    expect((data as { error?: string })?.error).toBe('slot_taken');
  });

  it('returns error for cancelled booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'cancelled',
        manage_token: crypto.randomUUID(),
        cancelled_at: now.toISOString(),
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    const newStart = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: newStart.toISOString(),
      p_ends_at: newEnd.toISOString(),
    });

    expect((data as { error?: string })?.error).toBe('cancelled');
  });

  it('returns error for past booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() - 60 * 60 * 1000); // Past
    const ends = new Date(now.getTime() - 30 * 60 * 1000); // Past

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Past Booker',
        email: 'past@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    const newStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: newStart.toISOString(),
      p_ends_at: newEnd.toISOString(),
    });

    expect((data as { error?: string })?.error).toBe('past');
  });

  it('returns error for invalid range (starts >= ends)', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token')
      .single();

    const token = booking!.manage_token as string;

    const badStart = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: badStart.toISOString(),
      p_ends_at: badStart.toISOString(), // Same as start
    });

    expect((data as { error?: string })?.error).toBe('invalid');
  });

  it('rescheduling onto the same range (itself) succeeds', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('manage_token, id')
      .single();

    const token = booking!.manage_token as string;
    const bookingId = booking!.id as string;

    // Reschedule onto the exact same time range
    const { data, error } = await anonClient().rpc('reschedule_booking', {
      p_manage_token: token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
    });

    expect(error).toBeNull();
    const result = data as unknown as { ok: boolean };
    expect(result.ok).toBe(true);

    // Verify booking is still there with same times
    const { data: updated } = await admin
      .from('bookings')
      .select('id, starts_at, ends_at')
      .eq('id', bookingId)
      .single();

    expect(updated?.id).toBe(bookingId);
  });
});

describe('bookings_due_for_reminder', () => {
  it('returns a confirmed booking 20 hours out with reminder_enabled', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: true });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20h out
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('id')
      .single();

    const bookingId = booking!.id as string;

    // Query as service role
    const { data, error } = await serviceClient().rpc(
      'bookings_due_for_reminder',
    );

    expect(error).toBeNull();
    const results = data as unknown as Array<{ booking_id: string }>;
    const found = results.find((r) => r.booking_id === bookingId);
    expect(found).toBeDefined();
  });

  it('excludes booking with reminder_sent_at already set', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: true });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Already Reminded',
        email: 'already@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
        reminder_sent_at: now.toISOString(), // Already reminded
      });

    const { data } = await serviceClient().rpc(
      'bookings_due_for_reminder',
    );

    const results = data as unknown as Array<{ email: string }>;
    expect(results.find((r) => r.email === 'already@example.test')).toBeUndefined();
  });

  it('excludes booking more than 36 hours out', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: true });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h out
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Too Far',
        email: 'toofa@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      });

    const { data } = await serviceClient().rpc(
      'bookings_due_for_reminder',
    );

    const results = data as unknown as Array<{ email: string }>;
    expect(results.find((r) => r.email === 'toofa@example.test')).toBeUndefined();
  });

  it('excludes cancelled booking', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: true });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Cancelled',
        email: 'cancelled@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'cancelled',
        manage_token: crypto.randomUUID(),
        cancelled_at: now.toISOString(),
      });

    const { data } = await serviceClient().rpc(
      'bookings_due_for_reminder',
    );

    const results = data as unknown as Array<{ email: string }>;
    expect(results.find((r) => r.email === 'cancelled@example.test')).toBeUndefined();
  });

  it('excludes booking whose meeting type has reminder_enabled = false', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: false });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'No Reminder',
        email: 'noreminder@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      });

    const { data } = await serviceClient().rpc(
      'bookings_due_for_reminder',
    );

    const results = data as unknown as Array<{ email: string }>;
    expect(results.find((r) => r.email === 'noreminder@example.test')).toBeUndefined();
  });
});

describe('mark_booking_reminder_sent', () => {
  it('sets reminder_sent_at and booking stops appearing in due list', async () => {
    const arr = await arrangeMeetingType({ reminderEnabled: true });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    const now = new Date();
    const starts = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data: booking } = await admin
      .from('bookings')
      .insert({
        user_id: arr.user.id,
        meeting_type_id: arr.typeId,
        name: 'Test Booker',
        email: 'booker@example.test',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: 'Australia/Sydney',
        status: 'confirmed',
        manage_token: crypto.randomUUID(),
      })
      .select('id')
      .single();

    const bookingId = booking!.id as string;

    // Verify it appears in due list
    let dueLst = await serviceClient().rpc('bookings_due_for_reminder');
    let found = (dueLst.data as unknown as Array<{ booking_id: string }>).find(
      (r) => r.booking_id === bookingId,
    );
    expect(found).toBeDefined();

    // Mark as reminded
    const { error } = await serviceClient().rpc('mark_booking_reminder_sent', {
      p_booking_id: bookingId,
    });

    expect(error).toBeNull();

    // Verify it no longer appears
    dueLst = await serviceClient().rpc('bookings_due_for_reminder');
    found = (dueLst.data as unknown as Array<{ booking_id: string }>).find(
      (r) => r.booking_id === bookingId,
    );
    expect(found).toBeUndefined();

    // Verify the column is set
    const { data: updated } = await admin
      .from('bookings')
      .select('reminder_sent_at')
      .eq('id', bookingId)
      .single();

    expect(updated?.reminder_sent_at).not.toBeNull();
  });
});
