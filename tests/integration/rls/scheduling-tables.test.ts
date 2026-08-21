import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for scheduling tables (Scheduler Phase B).
 *
 * Four tables make up the MC's availability engine: meeting_types (bookable
 * event templates), availability_rules (weekly base schedule),
 * availability_overrides (date-specific blocks or custom windows), and
 * meeting_type_availability_rules (one type's own weekly hours).
 * All are owner-only, because cross-tenant reads leak the MC's schedule,
 * cross-tenant writes could corrupt their availability.
 */
describe('RLS: scheduling tables tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let meetingTypeAId: string;
  let availabilityRuleAId: string;
  let availabilityOverrideAId: string;
  let meetingTypeRuleAId: string;
  let meetingTypeBId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    // Seed meeting_types row for userA
    const { data: meetingData, error: meetingError } = await userA.client
      .from('meeting_types')
      .insert({
        user_id: userA.id,
        name: 'Intro call',
        duration_minutes: 30,
      })
      .select('id')
      .single();
    expect(meetingError).toBeNull();
    meetingTypeAId = meetingData!.id;

    // Seed availability_rules row for userA
    const { data: ruleData, error: ruleError } = await userA.client
      .from('availability_rules')
      .insert({
        user_id: userA.id,
        weekday: 1,
        start_time: '10:00',
        end_time: '13:00',
      })
      .select('id')
      .single();
    expect(ruleError).toBeNull();
    availabilityRuleAId = ruleData!.id;

    // Seed availability_overrides row for userA
    const { data: overrideData, error: overrideError } = await userA.client
      .from('availability_overrides')
      .insert({
        user_id: userA.id,
        date: '2026-12-14',
        available: false,
      })
      .select('id')
      .single();
    expect(overrideError).toBeNull();
    availabilityOverrideAId = overrideData!.id;

    // Seed a per-meeting-type window for userA
    const { data: typeRuleData, error: typeRuleError } = await userA.client
      .from('meeting_type_availability_rules')
      .insert({
        user_id: userA.id,
        meeting_type_id: meetingTypeAId,
        weekday: 6,
        start_time: '08:00',
        end_time: '11:00',
      })
      .select('id')
      .single();
    expect(typeRuleError).toBeNull();
    meetingTypeRuleAId = typeRuleData!.id;

    // userB needs a meeting type of their own for the cross-parent case
    const { data: meetingBData, error: meetingBError } = await userB.client
      .from('meeting_types')
      .insert({
        user_id: userB.id,
        name: 'Site visit',
        duration_minutes: 45,
      })
      .select('id')
      .single();
    expect(meetingBError).toBeNull();
    meetingTypeBId = meetingBData!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  describe('meeting_types', () => {
    it('owner can read their own meeting type', async () => {
      const { data } = await userA.client
        .from('meeting_types')
        .select('id')
        .eq('id', meetingTypeAId);
      expect(data).toHaveLength(1);
    });

    it('owner reads correct defaults for new meeting type', async () => {
      const { data } = await userA.client
        .from('meeting_types')
        .select(
          'active, reminder_enabled, location_type, buffer_before_minutes, buffer_after_minutes, min_notice_hours, max_advance_days, share_token'
        )
        .eq('id', meetingTypeAId)
        .single();
      expect(data).toBeDefined();
      expect(data!.active).toBe(true);
      expect(data!.reminder_enabled).toBe(true);
      expect(data!.location_type).toBe('video');
      expect(data!.buffer_before_minutes).toBe(0);
      expect(data!.buffer_after_minutes).toBe(0);
      expect(data!.min_notice_hours).toBe(24);
      expect(data!.max_advance_days).toBe(60);
      expect(data!.share_token).toBeTruthy();
      expect(typeof data!.share_token).toBe('string');
    });

    it('another tenant cannot SELECT it', async () => {
      const { data, error } = await userB.client
        .from('meeting_types')
        .select('*')
        .eq('id', meetingTypeAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('another tenant cannot INSERT a row owned by userA', async () => {
      const { error } = await userB.client.from('meeting_types').insert({
        user_id: userA.id,
        name: 'Attacker type',
        duration_minutes: 60,
      });
      expect(error).not.toBeNull();
    });

    it('another tenant cannot UPDATE it', async () => {
      const { data } = await userB.client
        .from('meeting_types')
        .update({ name: 'Hijacked' })
        .eq('id', meetingTypeAId)
        .select('id');
      expect(data).toEqual([]);
    });

    it('another tenant cannot DELETE it', async () => {
      await userB.client.from('meeting_types').delete().eq('id', meetingTypeAId);
      const { data } = await userA.client
        .from('meeting_types')
        .select('id')
        .eq('id', meetingTypeAId);
      expect(data).toHaveLength(1);
    });

    it('anonymous clients see nothing', async () => {
      const { data } = await anonClient().from('meeting_types').select('id');
      expect(data ?? []).toEqual([]);
    });
  });

  describe('availability_rules', () => {
    it('owner can read their own availability rule', async () => {
      const { data } = await userA.client
        .from('availability_rules')
        .select('id')
        .eq('id', availabilityRuleAId);
      expect(data).toHaveLength(1);
    });

    it('another tenant cannot SELECT it', async () => {
      const { data, error } = await userB.client
        .from('availability_rules')
        .select('*')
        .eq('id', availabilityRuleAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('another tenant cannot INSERT a row owned by userA', async () => {
      const { error } = await userB.client.from('availability_rules').insert({
        user_id: userA.id,
        weekday: 2,
        start_time: '14:00',
        end_time: '17:00',
      });
      expect(error).not.toBeNull();
    });

    it('another tenant cannot UPDATE it', async () => {
      const { data } = await userB.client
        .from('availability_rules')
        .update({ start_time: '09:00' })
        .eq('id', availabilityRuleAId)
        .select('id');
      expect(data).toEqual([]);
    });

    it('another tenant cannot DELETE it', async () => {
      await userB.client
        .from('availability_rules')
        .delete()
        .eq('id', availabilityRuleAId);
      const { data } = await userA.client
        .from('availability_rules')
        .select('id')
        .eq('id', availabilityRuleAId);
      expect(data).toHaveLength(1);
    });

    it('anonymous clients see nothing', async () => {
      const { data } = await anonClient()
        .from('availability_rules')
        .select('id');
      expect(data ?? []).toEqual([]);
    });

    it('rejects insert with start_time >= end_time', async () => {
      const { error } = await userA.client.from('availability_rules').insert({
        user_id: userA.id,
        weekday: 3,
        start_time: '14:00',
        end_time: '14:00',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('availability_overrides', () => {
    it('owner can read their own availability override', async () => {
      const { data } = await userA.client
        .from('availability_overrides')
        .select('id')
        .eq('id', availabilityOverrideAId);
      expect(data).toHaveLength(1);
    });

    it('another tenant cannot SELECT it', async () => {
      const { data, error } = await userB.client
        .from('availability_overrides')
        .select('*')
        .eq('id', availabilityOverrideAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('another tenant cannot INSERT a row owned by userA', async () => {
      const { error } = await userB.client
        .from('availability_overrides')
        .insert({
          user_id: userA.id,
          date: '2026-12-25',
          available: false,
        });
      expect(error).not.toBeNull();
    });

    it('another tenant cannot UPDATE it', async () => {
      const { data } = await userB.client
        .from('availability_overrides')
        .update({ available: true })
        .eq('id', availabilityOverrideAId)
        .select('id');
      expect(data).toEqual([]);
    });

    it('another tenant cannot DELETE it', async () => {
      await userB.client
        .from('availability_overrides')
        .delete()
        .eq('id', availabilityOverrideAId);
      const { data } = await userA.client
        .from('availability_overrides')
        .select('id')
        .eq('id', availabilityOverrideAId);
      expect(data).toHaveLength(1);
    });

    it('anonymous clients see nothing', async () => {
      const { data } = await anonClient()
        .from('availability_overrides')
        .select('id');
      expect(data ?? []).toEqual([]);
    });

    it('rejects second insert for same (user_id, date)', async () => {
      const { error } = await userA.client
        .from('availability_overrides')
        .insert({
          user_id: userA.id,
          date: '2026-12-14',
          available: true,
          start_time: '10:00',
          end_time: '12:00',
        });
      expect(error).not.toBeNull();
    });
  });

  describe('meeting_type_availability_rules', () => {
    it('owner can read their own window', async () => {
      const { data, error } = await userA.client
        .from('meeting_type_availability_rules')
        .select('id')
        .eq('id', meetingTypeRuleAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('another tenant cannot read it', async () => {
      const { data, error } = await userB.client
        .from('meeting_type_availability_rules')
        .select('*')
        .eq('id', meetingTypeRuleAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('another tenant cannot INSERT a row owned by userA', async () => {
      const { error } = await userB.client
        .from('meeting_type_availability_rules')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          weekday: 1,
          start_time: '09:00',
          end_time: '17:00',
        });
      expect(error).not.toBeNull();
    });

    it('a tenant cannot attach hours to ANOTHER tenant\'s meeting type', async () => {
      // Foreign keys are checked with elevated privileges and ignore RLS, so
      // owning the row is not enough: the parent must be the writer's too.
      const { error } = await userB.client
        .from('meeting_type_availability_rules')
        .insert({
          user_id: userB.id,
          meeting_type_id: meetingTypeAId,
          weekday: 1,
          start_time: '09:00',
          end_time: '17:00',
        });
      expect(error).not.toBeNull();
    });

    it('a tenant CAN attach hours to their own meeting type', async () => {
      const { data, error } = await userB.client
        .from('meeting_type_availability_rules')
        .insert({
          user_id: userB.id,
          meeting_type_id: meetingTypeBId,
          weekday: 3,
          start_time: '18:00',
          end_time: '20:00',
        })
        .select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('another tenant cannot UPDATE it', async () => {
      const { data } = await userB.client
        .from('meeting_type_availability_rules')
        .update({ end_time: '23:00' })
        .eq('id', meetingTypeRuleAId)
        .select('id');
      expect(data).toEqual([]);
    });

    it('another tenant cannot DELETE it', async () => {
      await userB.client
        .from('meeting_type_availability_rules')
        .delete()
        .eq('id', meetingTypeRuleAId);
      const { data } = await userA.client
        .from('meeting_type_availability_rules')
        .select('id')
        .eq('id', meetingTypeRuleAId);
      expect(data).toHaveLength(1);
    });

    it('anonymous clients see nothing', async () => {
      const { data } = await anonClient()
        .from('meeting_type_availability_rules')
        .select('id');
      expect(data ?? []).toEqual([]);
    });

    it('rejects a backwards window', async () => {
      const { error } = await userA.client
        .from('meeting_type_availability_rules')
        .insert({
          user_id: userA.id,
          meeting_type_id: meetingTypeAId,
          weekday: 2,
          start_time: '17:00',
          end_time: '09:00',
        });
      expect(error).not.toBeNull();
    });

    it('cascades away when its meeting type is deleted', async () => {
      const { data: doomed } = await userA.client
        .from('meeting_types')
        .insert({ user_id: userA.id, name: 'Temp', duration_minutes: 15 })
        .select('id')
        .single();

      await userA.client.from('meeting_type_availability_rules').insert({
        user_id: userA.id,
        meeting_type_id: doomed!.id,
        weekday: 4,
        start_time: '09:00',
        end_time: '10:00',
      });

      await userA.client.from('meeting_types').delete().eq('id', doomed!.id);

      const { data } = await userA.client
        .from('meeting_type_availability_rules')
        .select('id')
        .eq('meeting_type_id', doomed!.id);
      expect(data).toEqual([]);
    });
  });
});
