import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dispatchPendingEvents } from '@/lib/workflows/dispatcher';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Appointment steps and the Scheduler.
 *
 * An appointment step is manual by default. Point it at a meeting type
 * and a confirmed booking against that type ticks it off, which is what
 * releases everything anchored behind it. Without this an MC who booked
 * a consultation through the Scheduler would still have to tick the
 * step by hand before the follow-up would send.
 *
 * Every fixture runs in Sydney time, not UTC: a booking's instant and
 * the MC's local day are different questions.
 */
describe('appointment steps complete on a Scheduler booking', () => {
  const admin = serviceClient();
  let user: TestUser;
  let meetingTypeId: string;
  let otherMeetingTypeId: string;

  /**
   * Sydney is UTC+11 in November, so the first slot is 10am local on the
   * 14th. `bookings` carries an exclusion constraint against overlapping
   * slots for one MC, so each booking gets its own hour.
   */
  let slot = 0;
  function nextSlot(): { startsAt: string; endsAt: string } {
    const base = Date.parse('2026-11-13T23:00:00.000Z') + slot * 3_600_000;
    slot += 1;
    return {
      startsAt: new Date(base).toISOString(),
      endsAt: new Date(base + 3_600_000).toISOString(),
    };
  }

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    await admin
      .from('user_public_settings')
      .upsert({ user_id: user.id, timezone: 'Australia/Sydney' }, { onConflict: 'user_id' });

    const { data: types, error } = await admin
      .from('meeting_types')
      .insert([
        { user_id: user.id, name: 'Consultation', duration_minutes: 60 },
        { user_id: user.id, name: 'Rehearsal walkthrough', duration_minutes: 30 },
      ])
      .select('id, name');
    expect(error).toBeNull();
    meetingTypeId = types!.find((t) => t.name === 'Consultation')!.id;
    otherMeetingTypeId = types!.find((t) => t.name === 'Rehearsal walkthrough')!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  /** A couple with an instance holding an appointment step and one behind it. */
  async function scenario(
    name: string,
    appointmentConfig: Record<string, unknown>,
  ): Promise<{ coupleId: string; appointmentId: string; gatedId: string }> {
    const { data: couple } = await admin
      .from('couples')
      .insert({ user_id: user.id, name })
      .select('id')
      .single();

    const { data: instance } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} flow` })
      .select('id')
      .single();

    const { data: steps, error } = await admin
      .from('workflow_steps')
      .insert([
        {
          instance_id: instance!.id,
          position: 0,
          type: 'appointment',
          title: 'Hold the consultation',
          config: appointmentConfig,
          timing: { mode: 'apply_relative', amount: 0, unit: 'days' },
          status: 'pending',
          due_at: '2026-01-01T00:00:00.000Z',
        },
        {
          instance_id: instance!.id,
          position: 1,
          type: 'action',
          title: 'Thank them for coming',
          config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
          timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
          status: 'pending',
          due_at: null,
        },
      ] as never)
      .select('id, position');
    expect(error).toBeNull();

    return {
      coupleId: couple!.id,
      appointmentId: steps!.find((s) => s.position === 0)!.id,
      gatedId: steps!.find((s) => s.position === 1)!.id,
    };
  }

  /** Confirm a booking, which fires the consultation_booked DB trigger. */
  async function book(coupleId: string, typeId: string): Promise<void> {
    const { startsAt, endsAt } = nextSlot();
    const { error } = await admin.from('bookings').insert({
      user_id: user.id,
      couple_id: coupleId,
      meeting_type_id: typeId,
      name: 'Sarah',
      email: 'sarah@example.com',
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: 'Australia/Sydney',
      status: 'confirmed',
    });
    expect(error).toBeNull();
  }

  async function step(id: string) {
    const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single();
    return data!;
  }

  it('ticks the step and releases what was gated behind it', async () => {
    const { coupleId, appointmentId, gatedId } = await scenario('Appointment Match', {
      meetingTypeId: undefined,
    });
    // Set the meeting type after the fact so the fixture above stays one shape.
    await admin
      .from('workflow_steps')
      .update({ config: { meetingTypeId } })
      .eq('id', appointmentId);

    expect((await step(gatedId)).due_at).toBeNull();

    await book(coupleId, meetingTypeId);
    const result = await dispatchPendingEvents(admin);

    expect(result.appointmentsCompleted).toBeGreaterThan(0);
    const done = await step(appointmentId);
    expect(done.status).toBe('done');
    expect(done.completed_at).not.toBeNull();
    // The gated step is only schedulable once its predecessor finished.
    expect((await step(gatedId)).due_at).not.toBeNull();
  });

  it('leaves a step pointed at a different meeting type alone', async () => {
    const { coupleId, appointmentId } = await scenario('Appointment Mismatch', {
      meetingTypeId,
    });

    await book(coupleId, otherMeetingTypeId);
    await dispatchPendingEvents(admin);

    expect((await step(appointmentId)).status).toBe('pending');
  });

  it('leaves a step with no meeting type alone', async () => {
    // No meeting type means "I will book it myself": the MC ticks it.
    const { coupleId, appointmentId } = await scenario('Appointment Manual', {});

    await book(coupleId, meetingTypeId);
    await dispatchPendingEvents(admin);

    expect((await step(appointmentId)).status).toBe('pending');
  });

  it('never completes another tenant appointment step', async () => {
    const other = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    try {
      const { data: theirCouple } = await admin
        .from('couples')
        .insert({ user_id: other.id, name: 'Not Yours' })
        .select('id')
        .single();
      const { data: theirInstance } = await admin
        .from('workflow_instances')
        .insert({ user_id: other.id, couple_id: theirCouple!.id, name: 'theirs' })
        .select('id')
        .single();
      const { data: theirStep } = await admin
        .from('workflow_steps')
        .insert({
          instance_id: theirInstance!.id,
          position: 0,
          type: 'appointment',
          title: 'Their consultation',
          // Same meeting type id, different couple: the match is on the
          // couple as well as the type, or one MC's booking would tick
          // another's step.
          config: { meetingTypeId },
          status: 'pending',
        })
        .select('id')
        .single();

      const { coupleId } = await scenario('Appointment Tenancy', { meetingTypeId });
      await book(coupleId, meetingTypeId);
      await dispatchPendingEvents(admin);

      expect((await step(theirStep!.id)).status).toBe('pending');
    } finally {
      await other.cleanup();
    }
  });

  it('does not tick a step on a cancelled workflow', async () => {
    const { coupleId, appointmentId } = await scenario('Appointment Cancelled', {
      meetingTypeId,
    });
    const { data: row } = await admin
      .from('workflow_steps')
      .select('instance_id')
      .eq('id', appointmentId)
      .single();
    await admin
      .from('workflow_instances')
      .update({ status: 'cancelled' })
      .eq('id', row!.instance_id);

    await book(coupleId, meetingTypeId);
    await dispatchPendingEvents(admin);

    expect((await step(appointmentId)).status).toBe('pending');
  });
});
