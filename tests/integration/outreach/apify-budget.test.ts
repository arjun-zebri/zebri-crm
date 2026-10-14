/**
 * The Apify budget under concurrency: two batches racing for the same run
 * must start exactly one Apify run, and an in-flight run must count against
 * the monthly cap before it finishes.
 *
 * The Apify client is stubbed. The stub waits before answering, so the two
 * batches really do overlap in the window the bug lived in.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/outreach/checks/instagram-apify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/outreach/checks/instagram-apify')>();
  return {
    ...actual,
    startProfileRun: vi.fn(async (handles: string[]) => {
      // Let a second batch get in during the window the old code left open.
      await new Promise((r) => setTimeout(r, 150));
      return { id: `apify-${handles.length}`, status: 'RUNNING', datasetId: 'ds-1', usageTotalUsd: null };
    }),
    getRun: vi.fn(async () => ({ id: 'apify-1', status: 'RUNNING', datasetId: 'ds-1', usageTotalUsd: null })),
  };
});

import { startProfileRun } from '@/lib/outreach/checks/instagram-apify';
import { advanceInstagramForRun } from '@/lib/outreach/services/checks';
import { newRefCode } from '@/lib/outreach/services/import';
import { apifySpendThisMonth } from '@/lib/outreach/services/settings';

import { serviceClient } from '../helpers/supabase';

const db = serviceClient();
const tag = `apify${Date.now()}`;
const prospectIds: string[] = [];
const runIds: string[] = [];
let savedBudget = 0;
let savedToken: string | undefined;

/** An IG run with `count` pending checks on fresh prospects. */
async function makeRun(count: number): Promise<string> {
  const { data: run, error } = await db
    .from('outreach_check_runs')
    .insert({ kind: 'ig_enrolment', status: 'running', total: count })
    .select('id')
    .single();
  if (error || !run) throw new Error(`run: ${error?.message}`);
  runIds.push(run.id);
  for (let i = 0; i < count; i++) {
    const { data: p, error: pErr } = await db
      .from('outreach_prospects')
      .insert({
        full_name: `IG ${tag} ${i}`, dedupe_key: `${tag}-${run.id}-${i}`, ref_code: newRefCode(),
        instagram_handle: `ig_${tag}_${i}`,
      })
      .select('id')
      .single();
    if (pErr || !p) throw new Error(`prospect: ${pErr?.message}`);
    prospectIds.push(p.id);
    const { error: cErr } = await db.from('outreach_checks').insert({ run_id: run.id, prospect_id: p.id, check: 'instagram' });
    if (cErr) throw new Error(`check: ${cErr.message}`);
  }
  return run.id;
}

describe('Apify budget under concurrency', () => {
  beforeAll(async () => {
    const { data } = await db.from('outreach_settings').select('apify_monthly_budget_cents').eq('id', true).single();
    savedBudget = data!.apify_monthly_budget_cents;
    await db.from('outreach_settings').update({ apify_monthly_budget_cents: 100_000 }).eq('id', true);
    savedToken = process.env.APIFY_TOKEN;
    process.env.APIFY_TOKEN = 'test-token';
  });

  afterAll(async () => {
    if (runIds.length) await db.from('outreach_check_runs').delete().in('id', runIds);
    if (prospectIds.length) await db.from('outreach_prospects').delete().in('id', prospectIds);
    await db.from('outreach_settings').update({ apify_monthly_budget_cents: savedBudget }).eq('id', true);
    if (savedToken === undefined) delete process.env.APIFY_TOKEN;
    else process.env.APIFY_TOKEN = savedToken;
  });

  it('two concurrent batches for one run start exactly one Apify run', async () => {
    vi.mocked(startProfileRun).mockClear();
    const runId = await makeRun(3);

    await Promise.all([advanceInstagramForRun(db, runId), advanceInstagramForRun(db, runId)]);

    expect(vi.mocked(startProfileRun)).toHaveBeenCalledTimes(1);
    const { data: run } = await db.from('outreach_check_runs').select('apify_run_id').eq('id', runId).single();
    expect(run!.apify_run_id).toBe('apify-3');
    const { data: checks } = await db.from('outreach_checks').select('status').eq('run_id', runId);
    expect(checks!.every((c) => c.status === 'claimed')).toBe(true);
    const { data: reservations } = await db.from('outreach_spend_reservations').select('status, amount_cents').eq('run_id', runId);
    // Three profiles at 0.23 cents each, rounded up to whole cents.
    expect(reservations).toEqual([{ status: 'reserved', amount_cents: 1 }]);
  });

  it('an in-flight reservation counts against the monthly spend before the run finishes', async () => {
    const before = await apifySpendThisMonth(db);
    const runId = await makeRun(2);
    await advanceInstagramForRun(db, runId);
    const after = await apifySpendThisMonth(db);
    expect(after - before).toBeGreaterThanOrEqual(1);
  });

  it('a batch that finds the budget spent starts nothing and skips the checks', async () => {
    await db.from('outreach_settings').update({ apify_monthly_budget_cents: 0 }).eq('id', true);
    try {
      vi.mocked(startProfileRun).mockClear();
      const runId = await makeRun(2);
      await advanceInstagramForRun(db, runId);
      expect(vi.mocked(startProfileRun)).not.toHaveBeenCalled();
      const { data: checks } = await db.from('outreach_checks').select('status').eq('run_id', runId);
      expect(checks!.every((c) => c.status === 'skipped')).toBe(true);
    } finally {
      await db.from('outreach_settings').update({ apify_monthly_budget_cents: 100_000 }).eq('id', true);
    }
  });
});
