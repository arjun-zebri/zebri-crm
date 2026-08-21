import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for bookings table (Scheduler Phase C).
 *
 * bookings are the confirmed consultations submitted via the public
 * /book page. They are owner-only for MC dashboard reads. The
 * exclusion constraint (no two confirmed bookings overlap per MC)
 * is the final arbiter of races. The consultation_booked trigger
 * fires on every confirmed insert to feed the automation bus.
 */
describe('RLS: bookings tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let meetingTypeAId: string;
  let coupleAId: string;
  let bookingAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    // Seed a couple for userA
    const { data: coupleData, error: coupleError } = await userA.client
      .from('couples')
      .insert({
        user_id: userA.id,
        name: 'Test Couple',
        email: 'couple@test.com',
        phone: '0412345678',
      })
      .select('id')
      .single();
    expect(coupleError).toBeNull();
    coupleAId = coupleData!.id;

    // Seed a meeting_type for userA
    const { data: meetingData, error: meetingError } = await userA.client
      .from('meeting_types')
      .insert({
        user_id: userA.id,
        name: 'Consultation',
        duration_minutes: 30,
      })
      .select('id')
      .single();
    expect(meetingError).toBeNull();
    meetingTypeAId = meetingData!.id;

    // Seed a booking for userA (10:00-10:30Z confirmed)
    const { data: bookingData, error: bookingError } = await serviceClient()
      .from('bookings')
      .insert({
        user_id: userA.id,
        meeting_type_id: meetingTypeAId,
        couple_id: coupleAId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '0412345678',
        starts_at: '2026-12-25T10:00:00Z',
        ends_at: '2026-12-25T10:30:00Z',
        timezone: 'Australia/Sydney',
        status: 'confirmed',
      })
      .select('id')
      .single();
    expect(bookingError).toBeNull();
    bookingAId = bookingData!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  describe('RLS isolation', () => {
    it('owner can read their own booking', async () => {
      const { data } = await userA.client
        .from('bookings')
        .select('id')
        .eq('id', bookingAId);
      expect(data).toHaveLength(1);
    });

    it('another tenant cannot SELECT it', async () => {
      const { data, error } = await userB.client
        .from('bookings')
        .select('*')
        .eq('id', bookingAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('another tenant cannot INSERT a row owned by userA', async () => {
      const { error } = await userB.client.from('bookings').insert({
        user_id: userA.id,
        meeting_type_id: meetingTypeAId,
        couple_id: coupleAId,
        name: 'Attacker',
        email: 'attacker@example.com',
        starts_at: '2026-12-25T14:00:00Z',
        ends_at: '2026-12-25T14:30:00Z',
        timezone: 'Australia/Sydney',
      });
      expect(error).not.toBeNull();
    });

    it('another tenant cannot UPDATE it', async () => {
      const { data } = await userB.client
        .from('bookings')
        .update({ name: 'Hijacked' })
        .eq('id', bookingAId)
        .select('id');
      expect(data).toEqual([]);
    });

    it('another tenant cannot DELETE it', async () => {
      await userB.client.from('bookings').delete().eq('id', bookingAId);
      const { data } = await userA.client
        .from('bookings')
        .select('id')
        .eq('id', bookingAId);
      expect(data).toHaveLength(1);
    });

    it('anonymous clients see nothing', async () => {
      const { data } = await anonClient().from('bookings').select('id');
      expect(data ?? []).toEqual([]);
    });
  });

  // Foreign keys are checked with elevated privileges and ignore RLS, so
  // owning the booking row is necessary but not sufficient: the couple and
  // meeting type it points at have to be the writer's too. Without the
  // WITH CHECK clauses userB could file a booking they own against userA's
  // couple, which links across tenants and confirms the id exists.
  describe('Parent ownership (FKs ignore RLS)', () => {
    let meetingTypeBId: string;

    beforeAll(async () => {
      const { data, error } = await userB.client
        .from('meeting_types')
        .insert({ user_id: userB.id, name: 'Consultation', duration_minutes: 30 })
        .select('id')
        .single();
      expect(error).toBeNull();
      meetingTypeBId = data!.id;
    });

    it('rejects an own-user booking that references another tenant\'s couple', async () => {
      const { error } = await userB.client.from('bookings').insert({
        user_id: userB.id,
        meeting_type_id: meetingTypeBId,
        couple_id: coupleAId,
        name: 'Cross tenant',
        email: 'cross@example.com',
        starts_at: '2027-01-05T10:00:00Z',
        ends_at: '2027-01-05T10:30:00Z',
        timezone: 'Australia/Sydney',
      });
      expect(error).not.toBeNull();
    });

    it('rejects an own-user booking that references another tenant\'s meeting type', async () => {
      const { error } = await userB.client.from('bookings').insert({
        user_id: userB.id,
        meeting_type_id: meetingTypeAId,
        name: 'Cross tenant',
        email: 'cross@example.com',
        starts_at: '2027-01-05T11:00:00Z',
        ends_at: '2027-01-05T11:30:00Z',
        timezone: 'Australia/Sydney',
      });
      expect(error).not.toBeNull();
    });

    it('rejects repointing an own booking onto another tenant\'s couple', async () => {
      const { data: mine, error: insertError } = await userB.client
        .from('bookings')
        .insert({
          user_id: userB.id,
          meeting_type_id: meetingTypeBId,
          name: 'Mine',
          email: 'mine@example.com',
          starts_at: '2027-01-06T10:00:00Z',
          ends_at: '2027-01-06T10:30:00Z',
          timezone: 'Australia/Sydney',
        })
        .select('id')
        .single();
      expect(insertError).toBeNull();

      const { error } = await userB.client
        .from('bookings')
        .update({ couple_id: coupleAId })
        .eq('id', mine!.id);
      expect(error).not.toBeNull();
    });

    it('accepts a booking whose couple and meeting type are both the writer\'s', async () => {
      const { data: coupleB, error: coupleError } = await userB.client
        .from('couples')
        .insert({ user_id: userB.id, name: 'B Couple', email: 'b@test.com', phone: '0400000000' })
        .select('id')
        .single();
      expect(coupleError).toBeNull();

      const { error } = await userB.client.from('bookings').insert({
        user_id: userB.id,
        meeting_type_id: meetingTypeBId,
        couple_id: coupleB!.id,
        name: 'Legit',
        email: 'legit@example.com',
        starts_at: '2027-01-07T10:00:00Z',
        ends_at: '2027-01-07T10:30:00Z',
        timezone: 'Australia/Sydney',
      });
      expect(error).toBeNull();
    });

    it('accepts a booking with no couple attached', async () => {
      const { error } = await userB.client.from('bookings').insert({
        user_id: userB.id,
        meeting_type_id: meetingTypeBId,
        couple_id: null,
        name: 'No couple yet',
        email: 'nocouple@example.com',
        starts_at: '2027-01-08T10:00:00Z',
        ends_at: '2027-01-08T10:30:00Z',
        timezone: 'Australia/Sydney',
      });
      expect(error).toBeNull();
    });
  });

  describe('Exclusion constraint', () => {
    it('rejects overlapping confirmed bookings for the same user', async () => {
      const { error } = await serviceClient()
        .from('bookings')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          couple_id: coupleAId,
          name: 'Jane Doe',
          email: 'jane@example.com',
          starts_at: '2026-12-25T10:15:00Z',
          ends_at: '2026-12-25T10:45:00Z',
          timezone: 'Australia/Sydney',
          status: 'confirmed',
        });
      expect(error).not.toBeNull();
      expect(error?.code).toBe('23P01');
    });

    it('allows overlapping confirmed bookings for different users', async () => {
      // Seed a meeting_type for userB
      const { data: meetingData } = await userB.client
        .from('meeting_types')
        .insert({
          user_id: userB.id,
          name: 'Consultation',
          duration_minutes: 30,
        })
        .select('id')
        .single();
      const meetingTypeB = meetingData!.id;

      const { error } = await serviceClient()
        .from('bookings')
        .insert({
          user_id: userB.id,
          meeting_type_id: meetingTypeB,
          name: 'Same Time',
          email: 'same@example.com',
          starts_at: '2026-12-25T10:00:00Z',
          ends_at: '2026-12-25T10:30:00Z',
          timezone: 'Australia/Sydney',
          status: 'confirmed',
        });
      expect(error).toBeNull();
    });

    it('allows overlapping cancelled bookings for the same user', async () => {
      const { error } = await serviceClient()
        .from('bookings')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          couple_id: coupleAId,
          name: 'Jane Cancelled',
          email: 'jane@example.com',
          starts_at: '2026-12-25T10:15:00Z',
          ends_at: '2026-12-25T10:45:00Z',
          timezone: 'Australia/Sydney',
          status: 'cancelled',
        });
      expect(error).toBeNull();
    });
  });

  describe('Trigger: consultation_booked automation event', () => {
    it('emits consultation_booked event on confirmed insert', async () => {
      // Insert a new confirmed booking
      const { data: bookingData } = await serviceClient()
        .from('bookings')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          couple_id: coupleAId,
          name: 'Event Trigger Test',
          email: 'trigger@example.com',
          phone: '0412345678',
          starts_at: '2026-12-26T14:00:00Z',
          ends_at: '2026-12-26T14:30:00Z',
          timezone: 'Australia/Sydney',
          status: 'confirmed',
        })
        .select('id')
        .single();
      expect(bookingData).toBeDefined();
      const newBookingId = bookingData!.id;

      // Check that automation_events contains a consultation_booked event for this booking
      const { data: events } = await serviceClient()
        .from('automation_events')
        .select('*')
        .eq('user_id', userA.id)
        .eq('event_type', 'consultation_booked')
        .eq('source_table', 'bookings')
        .eq('source_id', newBookingId);
      expect(events).toHaveLength(1);
      const payload = events![0]!.payload as Record<string, unknown>;
      expect(payload.booking_id).toBe(newBookingId);
      expect(payload.couple_id).toBe(coupleAId);
      expect(payload.meeting_type_id).toBe(meetingTypeAId);
      expect(payload.booker_name).toBe('Event Trigger Test');
      expect(payload.booker_email).toBe('trigger@example.com');
    });

    it('does not emit event on cancelled insert', async () => {
      const { data: bookingData } = await serviceClient()
        .from('bookings')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          couple_id: coupleAId,
          name: 'No Event',
          email: 'noevent@example.com',
          starts_at: '2026-12-27T10:00:00Z',
          ends_at: '2026-12-27T10:30:00Z',
          timezone: 'Australia/Sydney',
          status: 'cancelled',
        })
        .select('id')
        .single();
      expect(bookingData).toBeDefined();
      const newBookingId = bookingData!.id;

      const { data: events } = await serviceClient()
        .from('automation_events')
        .select('*')
        .eq('user_id', userA.id)
        .eq('source_table', 'bookings')
        .eq('source_id', newBookingId);
      expect(events).toHaveLength(0);
    });
  });
});
