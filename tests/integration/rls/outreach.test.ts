import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type DbClient, type TestUser } from '../helpers/supabase';

/**
 * RLS coverage for the Admin Outreach tables.
 *
 * These are admin-only operational tables with RLS on, NO policies and
 * every privilege revoked from anon/authenticated: only the service-role
 * client (behind assertAdmin and the cron tick) may touch them. Even a
 * real admin's own session is denied, because admin access is enforced
 * in the app layer, not by a policy.
 */
const TABLES = [
  'outreach_prospects', 'outreach_check_runs', 'outreach_checks', 'outreach_sequences', 'outreach_sequence_steps',
  'outreach_variants', 'outreach_campaigns', 'outreach_campaign_arms', 'outreach_enrollments', 'outreach_messages',
  'outreach_events', 'outreach_settings', 'outreach_mailbox', 'outreach_suppression', 'outreach_spend_reservations',
] as const;

describe('RLS: outreach tables', () => {
  let vendor: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    vendor = await createTestUser();
    admin = await createTestUser({}, { account_type: 'admin' });
  });

  afterAll(async () => {
    await vendor?.cleanup();
    await admin?.cleanup();
  });

  const clients = (): [string, DbClient][] => [['anon', anonClient()], ['vendor', vendor.client], ['admin session', admin.client]];

  for (const table of TABLES) {
    it(`${table}: no read or write for anon, vendors or an admin's own session`, async () => {
      for (const [who, client] of clients()) {
        const read = await client.from(table).select('*').limit(1);
        // 42501 = insufficient_privilege: denied by the grants, not by some other error.
        expect(read.error?.code, `${who} read ${table}`).toBe('42501');
        const write = await client.from(table).insert({} as never);
        expect(write.error?.code, `${who} insert ${table}`).toBe('42501');
      }
    });
  }

  it('the claim and candidate RPCs are not callable outside service role', async () => {
    for (const [who, client] of clients()) {
      const a = await client.rpc('outreach_claim_checks', { p_check: 'website', p_limit: 1 });
      expect(a.error?.code, `${who} claim_checks`).toBe('42501');
      const b = await client.rpc('outreach_claim_due_emails', { p_limit: 1 });
      expect(b.error?.code, `${who} claim_due_emails`).toBe('42501');
      const c = await client.rpc('outreach_enrol_candidates', { p_campaign: '00000000-0000-0000-0000-000000000000', p_limit: 1 });
      expect(c.error?.code, `${who} enrol_candidates`).toBe('42501');
      const d = await client.rpc('outreach_is_existing_customer', { p_email: 'x@example.com' });
      expect(d.error?.code, `${who} is_existing_customer`).toBe('42501');
      const e = await client.rpc('outreach_start_ig_batch', { p_run: '00000000-0000-0000-0000-000000000000', p_max: 1, p_budget_cents: 1, p_cents_per_profile: 0.23 });
      expect(e.error?.code, `${who} start_ig_batch`).toBe('42501');
      const f = await client.rpc('outreach_settle_ig_batch', { p_run: '00000000-0000-0000-0000-000000000000', p_actual_cents: 0 });
      expect(f.error?.code, `${who} settle_ig_batch`).toBe('42501');
      const g = await client.rpc('outreach_retention_pass', { p_cutoff: '2020-01-01T00:00:00Z' });
      expect(g.error?.code, `${who} retention_pass`).toBe('42501');
    }
  });
});
