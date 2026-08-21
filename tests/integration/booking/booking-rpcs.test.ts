/**
 * Scheduler Phase C - public booking RPCs security + behavior tests.
 *
 * The `/book/[token]` surface is unauthenticated: the share token IS the
 * capability. These tests hit the SECURITY DEFINER RPCs through the anon-key
 * client, exactly as the public page/route do in production, and prove:
 * token scoping (no cross-tenant write), couple matching/creation, booking
 * creation with double-booking guard, and the disabled/invalid-token guards.
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
 * Create an MC with an active meeting type (share_token enabled).
 */
async function arrangeMeetingType(opts: {
  name?: string;
  durationMinutes?: number;
  locationTypes?: 'video' | 'phone' | 'in_person';
  active?: boolean;
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

describe('get_public_booking_page', () => {
  it('returns null for a random token', async () => {
    const { data, error } = await anonClient().rpc('get_public_booking_page', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('returns the type + branding payload for a valid active token', async () => {
    const arr = await arrangeMeetingType({ name: 'Test Meeting' });
    cleanupQueue.push(arr.user.cleanup);

    const { data, error } = await anonClient().rpc(
      'get_public_booking_page',
      {
        token: arr.token,
      },
    );
    expect(error).toBeNull();

    const payload = data as unknown as {
      name: string;
      duration_minutes: number;
      location_type: string;
      business_name: string;
      brand_color?: string;
    };
    expect(payload.name).toBe('Test Meeting');
    expect(payload.duration_minutes).toBe(30);
    expect(payload.location_type).toBe('video');
    // business_name comes from user_metadata (may be null/empty string)
    expect(payload.business_name).toBeDefined();
    // branding merged in
    expect(typeof payload.brand_color).toBe('string');
  });

  it('returns null when the meeting type is inactive', async () => {
    const arr = await arrangeMeetingType({ active: false });
    cleanupQueue.push(arr.user.cleanup);

    const { data } = await anonClient().rpc('get_public_booking_page', {
      token: arr.token,
    });
    expect(data).toBeNull();
  });

  it('includes location address for in_person type', async () => {
    const arr = await arrangeMeetingType({
      locationTypes: 'in_person',
      name: 'In-Person Consult',
    });
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    // Update the meeting type with an address
    await admin
      .from('meeting_types')
      .update({ address: '123 Main St, Sydney NSW 2000' })
      .eq('id', arr.typeId);

    const { data, error } = await anonClient().rpc(
      'get_public_booking_page',
      {
        token: arr.token,
      },
    );
    expect(error).toBeNull();
    const payload = data as unknown as { address?: string };
    expect(payload.address).toBe('123 Main St, Sydney NSW 2000');
  });
});

describe('submit_booking', () => {
  it('rejects a random token without creating a booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
    const ends = new Date(starts.getTime() + 30 * 60 * 1000); // +30m

    const { data } = await anonClient().rpc('submit_booking', {
      token: '00000000-0000-0000-0000-000000000000',
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Test Booker',
      p_partner_name: null as any,
      p_email: 'test@example.test',
      p_phone: '+61 400 000 000',
      p_notes: 'Test booking',
    });
    expect((data as { error?: string }).error).toBe('not_found');

    // Verify no booking was created
    const { count } = await serviceClient()
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr.user.id);
    expect(count).toBe(0);
  });

  it('rejects inactive meeting type token', async () => {
    const arr = await arrangeMeetingType({ active: false });
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Test Booker',
      p_partner_name: null as any,
      p_email: 'test@example.test',
      p_phone: '+61 400 000 000',
      p_notes: null as any,
    });
    expect((data as { error?: string }).error).toBe('not_found');
  });

  it('rejects booking with starts_at >= ends_at', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // ends_at equals starts_at
    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: starts.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Test Booker',
      p_partner_name: null as any,
      p_email: 'test@example.test',
      p_phone: '+61 400 000 000',
      p_notes: null as any,
    });
    expect((data as { error?: string }).error).toBe('invalid');
  });

  it('rejects booking with duration mismatch > 60 seconds', async () => {
    const arr = await arrangeMeetingType({ durationMinutes: 30 });
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // Duration 45 minutes = 45 min * 60 sec = 2700 sec
    // Expected 30 min * 60 sec = 1800 sec
    // Difference = 900 sec > 60 sec, should be rejected
    const ends = new Date(starts.getTime() + 45 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Test Booker',
      p_partner_name: null as any,
      p_email: 'test@example.test',
      p_phone: '+61 400 000 000',
      p_notes: null as any,
    });
    expect((data as { error?: string }).error).toBe('invalid');
  });

  it('rejects booking with starts_at in the past', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() - 1000); // 1 second ago
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Test Booker',
      p_partner_name: null as any,
      p_email: 'test@example.test',
      p_phone: '+61 400 000 000',
      p_notes: null as any,
    });
    expect((data as { error?: string }).error).toBe('invalid');
  });

  it('creates a booking with all fields', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data, error } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Jamie Lee',
      p_partner_name: 'Sam Rivers',
      p_email: 'jamie@example.test',
      p_phone: '+61 400 000 000',
      p_notes: 'Looking for a video consultation',
    });

    expect(error).toBeNull();
    const result = data as unknown as {
      ok: boolean;
      booking_id: string;
      manage_token: string;
      user_id: string;
      couple_id: string | null;
      couple_created: boolean;
      couple_linked: boolean;
      business_name: string;
    };
    expect(result.ok).toBe(true);
    expect(typeof result.booking_id).toBe('string');
    expect(typeof result.manage_token).toBe('string');
    expect(result.user_id).toBe(arr.user.id);

    // Verify booking was created
    const admin = serviceClient();
    const { data: booking } = await admin
      .from('bookings')
      .select('*')
      .eq('id', result.booking_id)
      .single();

    expect(booking).toBeDefined();
    expect(booking?.name).toBe('Jamie Lee');
    expect(booking?.partner_name).toBe('Sam Rivers');
    expect(booking?.email).toBe('jamie@example.test');
    expect(booking?.phone).toBe('+61 400 000 000');
    expect(booking?.notes).toBe('Looking for a video consultation');
    expect(booking?.status).toBe('confirmed');
    expect(booking?.timezone).toBe('Australia/Sydney');
  });

  it('creates a couple when no email match exists', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'New Booker',
      p_partner_name: 'Partner Name',
      p_email: 'newbooker@example.test',
      p_phone: '+61 400 000 000',
      p_notes: 'First time booking',
    });

    const result = data as unknown as {
      ok: boolean;
      couple_id: string | null;
      couple_created: boolean;
      couple_linked: boolean;
    };
    expect(result.ok).toBe(true);
    expect(result.couple_created).toBe(true);
    expect(result.couple_linked).toBe(true);
    expect(typeof result.couple_id).toBe('string');

    // Verify couple was created with correct fields
    const admin = serviceClient();
    const { data: couple } = await admin
      .from('couples')
      .select('*')
      .eq('id', result.couple_id!)
      .single();

    expect(couple).toBeDefined();
    expect(couple?.user_id).toBe(arr.user.id);
    expect(couple?.name).toBe('New Booker');
    expect(couple?.primary_name).toBe('New Booker');
    expect(couple?.secondary_name).toBe('Partner Name');
    expect(couple?.primary_email).toBe('newbooker@example.test');
    expect(couple?.primary_phone).toBe('+61 400 000 000');
    expect(couple?.lead_source).toBe('booking');
  });

  it('matches existing couple by primary_email case-insensitively', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    // Create an existing couple
    const { data: coupleData } = await admin
      .from('couples')
      .insert({
        user_id: arr.user.id,
        name: 'Existing Couple',
        primary_name: 'Alice',
        primary_email: 'alice@Example.Test',
        status: 'new',
      })
      .select('id')
      .single();

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'New Name',
      p_partner_name: null as any,
      p_email: 'ALICE@example.test', // different case
      p_phone: '+61 400 000 001',
      p_notes: null as any,
    });

    const result = data as unknown as {
      couple_id: string | null;
      couple_created: boolean;
      couple_linked: boolean;
    };
    expect(result.couple_id).toBe(coupleData!.id);
    expect(result.couple_created).toBe(false);
    expect(result.couple_linked).toBe(true);
  });

  it('matches existing couple by legacy email column', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    // Create an existing couple with legacy email (no primary_email)
    const { data: coupleData } = await admin
      .from('couples')
      .insert({
        user_id: arr.user.id,
        name: 'Legacy Couple',
        email: 'legacy@Example.Test',
        primary_name: 'Bob',
        status: 'new',
      })
      .select('id')
      .single();

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Another Name',
      p_partner_name: null as any,
      p_email: 'LEGACY@example.test', // different case, legacy column
      p_phone: '+61 400 000 002',
      p_notes: null as any,
    });

    const result = data as unknown as {
      couple_id: string | null;
      couple_created: boolean;
      couple_linked: boolean;
    };
    expect(result.couple_id).toBe(coupleData!.id);
    expect(result.couple_created).toBe(false);
    expect(result.couple_linked).toBe(true);
  });

  it('prioritizes primary_email over legacy email match', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    // Create two couples: one with primary_email, one with legacy email
    const { data: couple1 } = await admin
      .from('couples')
      .insert({
        user_id: arr.user.id,
        name: 'Primary Email Match',
        primary_name: 'Charlie',
        primary_email: 'charlie@example.test',
        status: 'new',
      })
      .select('id')
      .single();

    await admin
      .from('couples')
      .insert({
        user_id: arr.user.id,
        name: 'Legacy Email Match',
        email: 'charlie@example.test',
        primary_name: 'Diana',
        status: 'new',
      })
      .select('id, created_at')
      .single();

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Yet Another Name',
      p_partner_name: null as any,
      p_email: 'charlie@example.test',
      p_phone: '+61 400 000 003',
      p_notes: null as any,
    });

    const result = data as unknown as { couple_id: string | null };
    // Should match the first one by created_at when both match email
    expect(result.couple_id).toBe(couple1!.id);
  });

  it('returns slot_taken when booking overlaps with existing confirmed booking', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends1 = new Date(starts1.getTime() + 30 * 60 * 1000);

    // First booking should succeed
    const { data: first } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts1.toISOString(),
      p_ends_at: ends1.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'First Booker',
      p_partner_name: null as any,
      p_email: 'first@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    expect((first as { ok?: boolean })?.ok).toBe(true);

    // Second overlapping booking should fail
    const starts2 = new Date(starts1.getTime() + 15 * 60 * 1000); // 15m after first starts
    const ends2 = new Date(starts2.getTime() + 30 * 60 * 1000);

    const { data: second } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts2.toISOString(),
      p_ends_at: ends2.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Second Booker',
      p_partner_name: null as any,
      p_email: 'second@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    expect((second as { error?: string })?.error).toBe('slot_taken');

    // Verify only first booking was created
    const admin = serviceClient();
    const { count } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr.user.id);
    expect(count).toBe(1);
  });

  it('allows back-to-back bookings without overlap', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const now = new Date();
    const starts1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends1 = new Date(starts1.getTime() + 30 * 60 * 1000);

    const { data: first } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts1.toISOString(),
      p_ends_at: ends1.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'First Booker',
      p_partner_name: null as any,
      p_email: 'first@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    expect((first as { ok?: boolean })?.ok).toBe(true);

    // Second booking starts exactly when first ends
    const starts2 = ends1;
    const ends2 = new Date(starts2.getTime() + 30 * 60 * 1000);

    const { data: second } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts2.toISOString(),
      p_ends_at: ends2.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Second Booker',
      p_partner_name: null as any,
      p_email: 'second@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    expect((second as { ok?: boolean })?.ok).toBe(true);

    // Verify both bookings were created
    const admin = serviceClient();
    const { count } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr.user.id);
    expect(count).toBe(2);
  });

  it('cross-tenant: token A never writes into user B account', async () => {
    const arr1 = await arrangeMeetingType();
    const arr2 = await arrangeMeetingType();
    cleanupQueue.push(arr1.user.cleanup, arr2.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    // Try to use user A's token to book with user B's email
    await anonClient().rpc('submit_booking', {
      token: arr1.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Attacker',
      p_partner_name: null as any,
      p_email: 'attacker@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    // Verify no booking was created for user B
    const { count } = await serviceClient()
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr2.user.id);
    expect(count).toBe(0);
  });

  it('handles plan limit by keeping couple_linked false and couple_id null', async () => {
    // Create a Starter user (capped at 5 couples)
    const user = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'starter',
      },
    );
    cleanupQueue.push(user.cleanup);

    const admin = serviceClient();
    // Create 5 couples to hit the limit
    for (let i = 0; i < 5; i++) {
      await admin.from('couples').insert({
        user_id: user.id,
        name: `Existing ${i}`,
        status: 'new',
      });
    }

    // Create meeting type for this user
    const { data: typeData } = await admin
      .from('meeting_types')
      .insert({
        user_id: user.id,
        name: 'Consultation',
        duration_minutes: 30,
        location_type: 'video',
        active: true,
      })
      .select('share_token')
      .single();

    const token = typeData!.share_token as string;

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Plan Limited',
      p_partner_name: null as any,
      p_email: 'limited@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    const result = data as unknown as {
      ok: boolean;
      booking_id?: string;
      couple_id: string | null;
      couple_created: boolean;
      couple_linked: boolean;
    };
    // Booking should still be created
    expect(result.ok).toBe(true);
    expect(typeof result.booking_id).toBe('string');
    // But couple creation fails silently
    expect(result.couple_id).toBeNull();
    expect(result.couple_created).toBe(false);
    expect(result.couple_linked).toBe(false);

    // Verify couple count unchanged (still 5)
    const { count } = await admin
      .from('couples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count).toBe(5);
  });

  it('returns rate_limited when 6+ bookings created for type in last hour', async () => {
    const arr = await arrangeMeetingType();
    cleanupQueue.push(arr.user.cleanup);

    const admin = serviceClient();
    // Create 6 non-overlapping bookings for this meeting type in the last hour
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const starts = new Date(now.getTime() + (24 + i) * 60 * 60 * 1000);
      const ends = new Date(starts.getTime() + 30 * 60 * 1000);
      await admin
        .from('bookings')
        .insert({
          user_id: arr.user.id,
          meeting_type_id: arr.typeId,
          name: `Existing Booking ${i}`,
          email: `existing${i}@example.test`,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          timezone: 'Australia/Sydney',
          status: 'confirmed',
          manage_token: crypto.randomUUID(),
        });
    }

    // Seventh anon submission should be rate-limited
    const starts = new Date(now.getTime() + 30 * 60 * 60 * 1000); // far future
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    const { data } = await anonClient().rpc('submit_booking', {
      token: arr.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Rate Limited Booker',
      p_email: 'ratelimited@example.test',
      p_partner_name: null as any,
      p_phone: null as any,
      p_notes: null as any,
    });

    expect((data as { error?: string })?.error).toBe('rate_limited');

    // Verify no 7th booking was created
    const { count } = await admin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', arr.user.id);
    expect(count).toBe(6); // unchanged
  });
});

describe('booking RLS', () => {
  it('a user cannot read another MC bookings row', async () => {
    const arr1 = await arrangeMeetingType();
    const arr2 = await arrangeMeetingType();
    cleanupQueue.push(arr1.user.cleanup, arr2.user.cleanup);

    const now = new Date();
    const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);

    // Create a booking for user 1
    await anonClient().rpc('submit_booking', {
      token: arr1.token,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
      p_timezone: 'Australia/Sydney',
      p_name: 'Booker',
      p_partner_name: null as any,
      p_email: 'booker@example.test',
      p_phone: null as any,
      p_notes: null as any,
    });

    // User 2 authenticated client must not see user 1's booking
    const { data } = await arr2.user.client
      .from('bookings')
      .select('id')
      .eq('user_id', arr1.user.id);
    expect(data ?? []).toHaveLength(0);
  });
});
