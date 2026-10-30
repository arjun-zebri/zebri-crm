/**
 * tg_proposals_emit_lifecycle: one bus event per old-to-new transition on
 * `proposals`, never on a touch (roadmap R2, spec 5.1). Runs against local
 * Supabase so the trigger, `emit_automation_event` and the RLS on
 * `automation_events` all execute for real.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let other: TestUser;
let coupleId: string;
let otherCoupleId: string;
let seq = 0;

interface BusRow {
  event_type: string;
  payload: Record<string, unknown>;
  couple_id: string | null;
  user_id: string;
}

async function seedProposal(overrides: Record<string, unknown> = {}): Promise<string> {
  seq += 1;
  const { data, error } = await user.client
    .from('proposals')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      proposal_number: `PR-L${seq}`,
      title: 'Wedding MC',
      status: 'draft',
      expires_at: '2027-01-15',
      ...overrides,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function eventsFor(proposalId: string, type?: string): Promise<BusRow[]> {
  let q = serviceClient()
    .from('automation_events')
    .select('event_type, payload, couple_id, user_id')
    .eq('source_table', 'proposals')
    .eq('source_id', proposalId);
  if (type) q = q.eq('event_type', type);
  const { data } = await q;
  return (data ?? []) as unknown as BusRow[];
}

async function patch(proposalId: string, values: Record<string, unknown>) {
  const { error } = await serviceClient().from('proposals').update(values).eq('id', proposalId);
  if (error) throw error;
}

beforeAll(async () => {
  user = await createTestUser();
  other = await createTestUser();
  const { data: c } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A & B', status: 'new', event_date: '2027-03-06' })
    .select('id')
    .single();
  coupleId = c!.id;
  const { data: oc } = await other.client
    .from('couples')
    .insert({ user_id: other.id, name: 'C & D', status: 'new' })
    .select('id')
    .single();
  otherCoupleId = oc!.id;
});
afterAll(async () => {
  await user.cleanup();
  await other.cleanup();
});

describe('tg_proposals_emit_lifecycle', () => {
  it('emits nothing on insert', async () => {
    const id = await seedProposal();
    expect(await eventsFor(id)).toHaveLength(0);
  });

  it('emits proposal_sent once when the share link is enabled, with the common payload', async () => {
    const id = await seedProposal();
    await patch(id, { share_token_enabled: true, status: 'sent' });
    await patch(id, { share_token_enabled: true, updated_at: new Date().toISOString() });
    await patch(id, { version: 2 });
    const rows = await eventsFor(id, 'proposal_sent');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.couple_id).toBe(coupleId);
    expect(rows[0]!.user_id).toBe(user.id);
    expect(rows[0]!.payload).toMatchObject({
      proposal_id: id,
      couple_id: coupleId,
      proposal_number: expect.stringMatching(/^PR-L/),
      title: 'Wedding MC',
      event_date: '2027-03-06',
      expires_at: '2027-01-15',
    });
    expect(typeof rows[0]!.payload.share_token).toBe('string');
  });

  it('re-emits proposal_sent when a link is turned off and on again', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { share_token_enabled: false, status: 'draft' });
    await patch(id, { share_token_enabled: true, status: 'sent' });
    expect(await eventsFor(id, 'proposal_sent')).toHaveLength(1);
  });

  it('emits proposal_opened once when first_viewed_at is stamped', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    const now = new Date().toISOString();
    await patch(id, { first_viewed_at: now, view_count: 1, status: 'viewed' });
    await patch(id, { view_count: 2, last_viewed_at: now });
    expect(await eventsFor(id, 'proposal_opened')).toHaveLength(1);
  });

  it('emits proposal_accepted once with the option and total when accepted_at is stamped', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    const { data: opt } = await user.client
      .from('proposal_options')
      .insert({ proposal_id: id, user_id: user.id, position: 1, title: 'Reception MC', subtotal: 1400 })
      .select('id')
      .single();
    await patch(id, { accepted_option_id: opt!.id });
    await patch(id, { accepted_at: new Date().toISOString(), status: 'accepted' });
    await patch(id, { updated_at: new Date().toISOString() });
    const rows = await eventsFor(id, 'proposal_accepted');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({
      accepted_option_id: opt!.id,
      option_title: 'Reception MC',
      total: 1400,
    });
  });

  it("leaves option_title null when accepted_option_id points at another tenant's option", async () => {
    // The trigger body runs as definer, so only its own parentage match
    // (`o.proposal_id = new.id`) stops a foreign pointer copying that
    // tenant's option title and subtotal onto this tenant's bus.
    const { data: foreignProposal } = await other.client
      .from('proposals')
      .insert({
        user_id: other.id,
        couple_id: otherCoupleId,
        proposal_number: 'PR-FOREIGN',
        title: 'Not yours',
        status: 'draft',
      })
      .select('id')
      .single();
    const { data: foreignOpt } = await other.client
      .from('proposal_options')
      .insert({
        proposal_id: foreignProposal!.id,
        user_id: other.id,
        position: 1,
        title: 'Foreign package',
        subtotal: 9900,
      })
      .select('id')
      .single();
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { accepted_option_id: foreignOpt!.id });
    await patch(id, { accepted_at: new Date().toISOString(), status: 'accepted' });
    const rows = await eventsFor(id, 'proposal_accepted');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ accepted_option_id: foreignOpt!.id, option_title: null, total: null });
  });

  it('emits proposal_declined once with the reason and message', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, {
      declined_at: new Date().toISOString(),
      declined_reason: 'price',
      declined_message: 'Over budget',
      status: 'declined',
    });
    await patch(id, { declined_message: 'Over budget, sorry' });
    const rows = await eventsFor(id, 'proposal_declined');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ declined_reason: 'price', declined_message: 'Over budget' });
  });

  it('emits proposal_expired once when expire_proposals flips the status', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent', expires_at: '2020-01-01' });
    await serviceClient().rpc('expire_proposals');
    await serviceClient().rpc('expire_proposals');
    const rows = await eventsFor(id, 'proposal_expired');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({ expires_at: '2020-01-01' });
  });

  it('never shows another tenant the emitted rows', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { first_viewed_at: new Date().toISOString() });
    const { data } = await other.client
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect(data ?? []).toHaveLength(0);
    const { data: own } = await user.client
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect((own ?? []).length).toBeGreaterThan(0);
  });

  it('shows an anonymous visitor nothing', async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { first_viewed_at: new Date().toISOString() });
    const { data, error } = await anonClient()
      .from('automation_events')
      .select('id')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("lets another tenant neither update nor delete the owner's rows", async () => {
    const id = await seedProposal({ share_token_enabled: true, status: 'sent' });
    await patch(id, { first_viewed_at: new Date().toISOString() });
    const { data: updated } = await other.client
      .from('automation_events')
      .update({ event_type: 'proposal_accepted' })
      .eq('source_table', 'proposals')
      .eq('source_id', id)
      .select('id');
    expect(updated ?? []).toHaveLength(0);
    const { data: deleted } = await other.client
      .from('automation_events')
      .delete()
      .eq('source_table', 'proposals')
      .eq('source_id', id)
      .select('id');
    expect(deleted ?? []).toHaveLength(0);
    const rows = await eventsFor(id);
    expect(rows.map((r) => r.event_type)).toEqual(['proposal_opened']);
    const { data: own } = await user.client
      .from('automation_events')
      .select('event_type')
      .eq('source_table', 'proposals')
      .eq('source_id', id);
    expect(own).toEqual([{ event_type: 'proposal_opened' }]);
  });
});

describe('emit_automation_event grant', () => {
  // The RPC is definer and inserts whatever `p_user_id` it is handed, so
  // the only thing between a signed-in user and another tenant's bus is
  // the execute grant. 20261002100000 revokes it from every non-service
  // role; both the victim's own session and a stranger's must be refused.
  async function tryEmit(client: TestUser['client'], proposalId: string) {
    return client.rpc('emit_automation_event' as never, {
      p_user_id: user.id,
      p_source_table: 'proposals',
      p_source_id: proposalId,
      p_event_type: 'proposal_expiring',
      p_payload: { days_until_expiry: 3 },
      p_couple_id: coupleId,
    } as never);
  }

  it('refuses another tenant and writes nothing', async () => {
    const id = await seedProposal();
    const { error } = await tryEmit(other.client, id);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
    expect(await eventsFor(id)).toHaveLength(0);
  });

  it('refuses the owner too: the grant is gone for every authenticated role', async () => {
    const id = await seedProposal();
    const { error } = await tryEmit(user.client, id);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
    expect(await eventsFor(id)).toHaveLength(0);
  });
});
