/**
 * proposal_template_performance / proposal_account_summary: counts, revenue
 * (invoice beats package), median time to open from `opened` events only,
 * tenant isolation via RLS, anon denied, a bogus stored timezone, an
 * acceptance outside this month, and a template-less proposal that splits
 * the account median from the per-template one.
 * Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

let a: TestUser;
let b: TestUser;
let templateId: string;
let p1: { id: string; share_token: string };
let p2: { id: string; share_token: string };

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

async function seed(user: TestUser, coupleId: string, n: string, overrides: Record<string, unknown>) {
  const { data, error } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: `PR-AN-${n}`, title: n, status: 'sent', share_token_enabled: true, ...overrides })
    .select('id, share_token')
    .single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { data: c, error: ce } = await a.client.from('couples').insert({ user_id: a.id, name: 'A & B', status: 'new' }).select('id').single();
  if (ce) throw ce;
  const coupleId = c!.id;

  const { data: t, error: te } = await a.client.from('proposal_templates').insert({ user_id: a.id, name: 'T', layout: {} }).select('id').single();
  if (te) throw te;
  templateId = t!.id;

  p1 = await seed(a, coupleId, '1', { template_id: templateId, status: 'accepted', email_sent_at: hoursAgo(2), accepted_at: new Date().toISOString() });
  p2 = await seed(a, coupleId, '2', { template_id: templateId, status: 'sent', email_sent_at: hoursAgo(1) });
  await seed(a, coupleId, '3', { template_id: templateId, status: 'draft' });
  // P4: first_viewed_at set but no `opened` event (the MC's own preview).
  await seed(a, coupleId, '4', { status: 'viewed', first_viewed_at: new Date().toISOString(), email_sent_at: hoursAgo(3) });
  // P5: accepted 40 days ago, so it counts as accepted but never as
  // revenue this month (no month is 40 days long).
  const p5 = await seed(a, coupleId, '5', { status: 'accepted', email_sent_at: daysAgo(41), accepted_at: daysAgo(40) });
  // P6: no template, opened about 10h after the email. It feeds the account
  // median (samples ~1h, ~2h, ~10h: median ~2h) but not template T's (~1.5h).
  const p6 = await seed(a, coupleId, '6', { status: 'viewed', email_sent_at: hoursAgo(10) });

  const { data: o, error: oe } = await a.client
    .from('proposal_options')
    .insert({ proposal_id: p1.id, user_id: a.id, position: 0, title: 'Pkg', subtotal: 1000 })
    .select('id')
    .single();
  if (oe) throw oe;
  const upd = await a.client.from('proposals').update({ accepted_option_id: o!.id }).eq('id', p1.id);
  if (upd.error) throw upd.error;
  const { data: o5, error: o5e } = await a.client
    .from('proposal_options')
    .insert({ proposal_id: p5.id, user_id: a.id, position: 0, title: 'Old pkg', subtotal: 500 })
    .select('id')
    .single();
  if (o5e) throw o5e;
  const upd5 = await a.client.from('proposals').update({ accepted_option_id: o5!.id }).eq('id', p5.id);
  if (upd5.error) throw upd5.error;

  for (const [p, s] of [[p1, 's1'], [p2, 's2'], [p6, 's6']] as const) {
    const r = await anonClient().rpc('record_proposal_events', { p_token: p.share_token, p_session_id: s, p_events: [{ id: `ev-${s}`, type: 'opened', payload: {} }] });
    if (r.error) throw r.error;
  }
});
afterAll(async () => {
  await a.cleanup();
  await b.cleanup();
});

describe('proposal analytics functions', () => {
  it('per-template performance for the owner', async () => {
    const { data, error } = await a.client.rpc('proposal_template_performance');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const row = data![0]!;
    expect(row.template_id).toBe(templateId);
    expect(row.sent).toBe(2);
    expect(row.accepted).toBe(1);
    expect(Number(row.revenue)).toBe(1000);
    expect(Number(row.median_open_seconds)).toBeGreaterThan(5000);
    expect(Number(row.median_open_seconds)).toBeLessThan(5900);
  });

  it('account summary; P4 (no opened event) does not feed the median', async () => {
    const { data, error } = await a.client.rpc('proposal_account_summary');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const row = data![0]!;
    // P1, P2, P4, P5, P6 (P3 is a draft).
    expect(row.sent).toBe(5);
    // P1 this month and P5 forty days ago.
    expect(row.accepted).toBe(2);
    // P5's 500 is outside this month.
    expect(Number(row.revenue_this_month)).toBe(1000);
    // Samples are P1 (~2h), P2 (~1h) and P6 (~10h): median ~7200. A P4 gap
    // of ~3h would make it 4 samples with a median of ~9000; it must not.
    expect(Number(row.median_open_seconds)).toBeGreaterThan(7000);
    expect(Number(row.median_open_seconds)).toBeLessThan(7600);
  });

  it('the per-template median is T only, apart from the account median', async () => {
    const perf = await a.client.rpc('proposal_template_performance');
    const sum = await a.client.rpc('proposal_account_summary');
    expect(perf.error).toBeNull();
    expect(sum.error).toBeNull();
    // P6 has no template, so only the account median sees its ~10h gap.
    expect(perf.data).toHaveLength(1);
    const templateMedian = Number(perf.data![0]!.median_open_seconds);
    const accountMedian = Number(sum.data![0]!.median_open_seconds);
    expect(templateMedian).toBeGreaterThan(5000);
    expect(templateMedian).toBeLessThan(5900);
    expect(accountMedian).toBeGreaterThan(templateMedian + 1000);
  });

  it('another tenant sees nothing', async () => {
    const perf = await b.client.rpc('proposal_template_performance');
    expect(perf.error).toBeNull();
    expect(perf.data).toHaveLength(0);
    const sum = await b.client.rpc('proposal_account_summary');
    expect(sum.error).toBeNull();
    expect(sum.data).toHaveLength(1);
    expect(sum.data![0]).toMatchObject({ sent: 0, accepted: 0, median_open_seconds: null });
    expect(Number(sum.data![0]!.revenue_this_month)).toBe(0);
  });

  it('anon cannot execute either function', async () => {
    expect((await anonClient().rpc('proposal_template_performance')).error).not.toBeNull();
    expect((await anonClient().rpc('proposal_account_summary')).error).not.toBeNull();
  });

  it('an unknown stored timezone falls back instead of erroring', async () => {
    const s = await a.client.from('user_public_settings').upsert({ user_id: a.id, timezone: 'Not/AZone' }, { onConflict: 'user_id' });
    expect(s.error).toBeNull();
    const { data, error } = await a.client.rpc('proposal_account_summary');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('revenue prefers the invoice subtotal over the package', async () => {
    const { data: c } = await a.client.from('couples').select('id').limit(1).single();
    const inv = await a.client
      .from('invoices')
      .insert({ user_id: a.id, couple_id: c!.id, invoice_number: 'INV-AN-1', title: 'I', subtotal: 1200 })
      .select('id')
      .single();
    if (inv.error) throw inv.error;
    const upd = await a.client.from('proposals').update({ invoice_id: inv.data.id }).eq('id', p1.id);
    expect(upd.error).toBeNull();
    const perf = await a.client.rpc('proposal_template_performance');
    expect(Number(perf.data![0]!.revenue)).toBe(1200);
    const sum = await a.client.rpc('proposal_account_summary');
    expect(Number(sum.data![0]!.revenue_this_month)).toBe(1200);
  });
});
