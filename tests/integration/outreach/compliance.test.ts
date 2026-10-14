/**
 * Spam Act and privacy rules against the real schema and RLS-free service
 * client: the global suppression list, existing-customer exclusion, scraped
 * emails never mailable until confirmed, and the send-time gate.
 *
 * Every row is tagged with a run-unique suffix and removed afterwards; the
 * settings row is restored.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ProspectInput } from '@/lib/outreach/import/sheet';
import { updateProspect } from '@/lib/outreach/services/admin-ops';
import { optOut } from '@/lib/outreach/services/events';
import { newRefCode, importProspects } from '@/lib/outreach/services/import';
import { isSuppressed, sendBlockReason, suppressAddress } from '@/lib/outreach/services/suppression';
import type { OutreachSettings } from '@/lib/outreach/types';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const db = serviceClient();
const tag = `comp${Date.now()}`;
const prospectIds: string[] = [];
const campaignIds: string[] = [];
const suppressed: string[] = [];
let customer: TestUser;
let saved: Pick<OutreachSettings, 'sender_name' | 'signature'>;

/** A minimal prospect row, active and new, ready to be a candidate. */
function row(overrides: Record<string, unknown>) {
  const n = Math.random().toString(36).slice(2, 8);
  return {
    full_name: `Celebrant ${tag}-${n}`,
    dedupe_key: `${tag}-${n}`,
    ref_code: newRefCode(),
    verdict: 'active',
    stage: 'new',
    email: null,
    email_source: null,
    email_check: 'ok',
    instagram_handle: null,
    ...overrides,
  };
}

async function insertProspect(overrides: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from('outreach_prospects').insert(row(overrides) as never).select('id').single();
  if (error || !data) throw new Error(`insert prospect: ${error?.message}`);
  prospectIds.push(data.id);
  return data.id;
}

async function prospectRow(id: string) {
  const { data, error } = await db.from('outreach_prospects').select('*').eq('id', id).single();
  if (error || !data) throw new Error(`load prospect: ${error?.message}`);
  return data;
}

async function setSettings(patch: Partial<Pick<OutreachSettings, 'sender_name' | 'signature'>>) {
  const { error } = await db.from('outreach_settings').update(patch).eq('id', true);
  if (error) throw new Error(`settings: ${error.message}`);
}

describe('outreach compliance', () => {
  beforeAll(async () => {
    customer = await createTestUser();
    const { data } = await db.from('outreach_settings').select('sender_name, signature').eq('id', true).single();
    saved = data!;
    await setSettings({ sender_name: 'Jo Test', signature: 'Jo Test\njo@example.com' });
  });

  afterAll(async () => {
    if (prospectIds.length) await db.from('outreach_prospects').delete().in('id', prospectIds);
    if (campaignIds.length) await db.from('outreach_campaigns').delete().in('id', campaignIds);
    if (suppressed.length) await db.from('outreach_suppression').delete().like('value', `%${tag}%`);
    await setSettings(saved);
    await customer?.cleanup();
  });

  describe('global suppression', () => {
    it('a re-import under a new merge key is flagged do-not-contact and blocked from sending', async () => {
      const email = `${tag}-optout@example.com`;
      await suppressAddress(db, { email }, 'opted_out', 'test');
      suppressed.push(email);

      const incoming: ProspectInput = {
        registration_no: `REG-${tag}`, full_name: `Re Import ${tag}`, first_name: null, last_name: null,
        state: 'NSW', suburb: 'Bondi', postcode: null, email: email.toUpperCase(), phone: null, website: null,
        instagram_handle: null, facebook_url: null, sheet_notes: null, sheet_status: null, sheet_raw: {},
        dedupe_key: `${tag}-reimport`,
      };
      const outcome = await importProspects(db, [incoming]);
      expect(outcome.inserted).toBe(1);

      const { data } = await db.from('outreach_prospects').select('*').eq('registration_no', `REG-${tag}`).single();
      prospectIds.push(data!.id);
      expect(data!.do_not_contact).toBe(true);
      expect(await sendBlockReason(db, data!)).toBe('suppressed');
    });

    it('opting out writes the address and the handle to the global list', async () => {
      const id = await insertProspect({ email: `${tag}-stop@example.com`, instagram_handle: `stop_${tag}` });
      await optOut(db, id, 'test');
      const { data } = await db.from('outreach_suppression').select('kind, value, reason').like('value', `%${tag}%`);
      expect(data).toEqual(expect.arrayContaining([
        { kind: 'email', value: `${tag}-stop@example.com`, reason: 'opted_out' },
        { kind: 'instagram', value: `stop_${tag}`, reason: 'opted_out' },
      ]));
      suppressed.push(`${tag}-stop@example.com`, `stop_${tag}`);
    });

    it('a bounce never downgrades an opt-out', async () => {
      const email = `${tag}-both@example.com`;
      suppressed.push(email);
      await suppressAddress(db, { email }, 'opted_out', 'test');
      await suppressAddress(db, { email }, 'bounced', 'gmail');
      const { data } = await db.from('outreach_suppression').select('reason').eq('kind', 'email').eq('value', email).single();
      expect(data!.reason).toBe('opted_out');
    });

    it('a manually added person who is suppressed is flagged at the door', async () => {
      const { addProspect } = await import('@/lib/outreach/services/add-prospect');
      const { buildManualProspect } = await import('@/lib/outreach/import/manual');
      const email = `${tag}-manual-stop@example.com`;
      suppressed.push(email);
      await suppressAddress(db, { email }, 'manual', 'test');
      const built = buildManualProspect({ full_name: `Manual ${tag}`, suburb: 'Newtown', state: 'NSW', email, instagram: '' });
      if (!built.ok) throw new Error('fixture');
      const { id } = await addProspect(db, built.prospect, null);
      prospectIds.push(id);
      expect((await prospectRow(id)).do_not_contact).toBe(true);
    });
  });

  describe('enrolment candidates', () => {
    it('excludes suppressed addresses, existing customers and scraped-only emails; keeps a confirmed one', async () => {
      const { data: campaign } = await db.from('outreach_campaigns').insert({ name: `camp ${tag}`, status: 'active', audience: {} }).select('id').single();
      campaignIds.push(campaign!.id);

      const good = await insertProspect({ email: `${tag}-good@example.com`, email_source: 'manual' });
      const suppressedId = await insertProspect({ email: `${tag}-blocked@example.com`, email_source: 'manual' });
      suppressed.push(`${tag}-blocked@example.com`);
      await suppressAddress(db, { email: `${tag}-blocked@example.com` }, 'opted_out', 'test');
      const existing = await insertProspect({ email: customer.email, email_source: 'manual' });
      const linked = await insertProspect({ email: `${tag}-linked@example.com`, email_source: 'manual', linked_user_id: customer.id });
      const foundOnly = await insertProspect({ email: `${tag}-found@example.com`, email_source: 'found' });
      const foundWithIg = await insertProspect({ email: `${tag}-found-ig@example.com`, email_source: 'found', instagram_handle: `ig_${tag}` });

      const { data, error } = await db.rpc('outreach_enrol_candidates', { p_campaign: campaign!.id, p_limit: 500 });
      expect(error).toBeNull();
      const ids = (data ?? []).map((p) => p.id);
      expect(ids).toContain(good);
      expect(ids).toContain(foundWithIg);
      expect(ids).not.toContain(suppressedId);
      expect(ids).not.toContain(existing);
      expect(ids).not.toContain(linked);
      expect(ids).not.toContain(foundOnly);
    });

    it('a bounce rules out the email, not the person: Instagram stays open, the import does not flag them', async () => {
      const { data: campaign } = await db.from('outreach_campaigns').insert({ name: `bounce ${tag}`, status: 'active', audience: {} }).select('id').single();
      campaignIds.push(campaign!.id);
      const withIg = await insertProspect({ email: `${tag}-bounced-ig@example.com`, email_source: 'manual', instagram_handle: `bounced_${tag}` });
      const emailOnly = await insertProspect({ email: `${tag}-bounced@example.com`, email_source: 'manual' });
      for (const email of [`${tag}-bounced-ig@example.com`, `${tag}-bounced@example.com`]) {
        suppressed.push(email);
        await suppressAddress(db, { email }, 'bounced', 'test');
      }
      const { data } = await db.rpc('outreach_enrol_candidates', { p_campaign: campaign!.id, p_limit: 500 });
      const ids = (data ?? []).map((p) => p.id);
      expect(ids).toContain(withIg);
      expect(ids).not.toContain(emailOnly);
      // The email itself still never goes out.
      expect(await sendBlockReason(db, await prospectRow(withIg))).toBe('suppressed');
      // A person whose only problem is a dead address is not put on do-not-contact.
      expect(await isSuppressed(db, { email: `${tag}-bounced@example.com`, instagram_handle: null }, { includeBounced: false })).toBe(false);
    });
  });

  describe('send-time gate', () => {
    it('allows a confirmed email from a set-up sender', async () => {
      const id = await insertProspect({ email: `${tag}-ok@example.com`, email_source: 'manual' });
      expect(await sendBlockReason(db, await prospectRow(id))).toBeNull();
    });

    it('blocks a scraped email until the founder confirms it', async () => {
      const id = await insertProspect({ email: `${tag}-scraped@example.com`, email_source: 'found' });
      expect(await sendBlockReason(db, await prospectRow(id))).toBe('unconfirmed_email');

      await updateProspect(db, id, { confirm_email: true });
      const after = await prospectRow(id);
      expect(after.email_source).toBe('manual');
      expect(await sendBlockReason(db, after)).toBeNull();

      const { data: events } = await db.from('outreach_events').select('type, payload').eq('prospect_id', id);
      expect(events).toEqual(expect.arrayContaining([
        { type: 'manual_touch', payload: { kind: 'email_confirmed', email: `${tag}-scraped@example.com` } },
      ]));
    });

    it('blocks an existing customer, matched by linked user or by auth email', async () => {
      const byEmail = await insertProspect({ email: customer.email, email_source: 'manual' });
      expect(await sendBlockReason(db, await prospectRow(byEmail))).toBe('existing_customer');
      const byLink = await insertProspect({ email: `${tag}-l@example.com`, email_source: 'manual', linked_user_id: customer.id });
      expect(await sendBlockReason(db, await prospectRow(byLink))).toBe('existing_customer');
    });

    it('blocks sending while the sender identity is missing, or the signature has no contact details', async () => {
      const id = await insertProspect({ email: `${tag}-id@example.com`, email_source: 'manual' });
      await setSettings({ sender_name: '' });
      expect(await sendBlockReason(db, await prospectRow(id))).toBe('no_sender_identity');
      await setSettings({ sender_name: 'Jo Test', signature: 'Jo Test' });
      expect(await sendBlockReason(db, await prospectRow(id))).toBe('no_sender_identity');
      await setSettings({ sender_name: 'Jo Test', signature: 'Jo Test\njo@example.com' });
    });
  });
});
