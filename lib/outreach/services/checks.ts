/**
 * Run activity checks over prospects: website (free) first, email
 * (free), then Instagram (paid, only where the website didn't settle it,
 * inside the monthly cap).
 *
 * Work is queued as `outreach_checks` rows and drained in small batches
 * by whoever calls {@link processCheckBatch}: the open Prospects page (fast)
 * or the per-minute tick (slow but steady). Claims are atomic, so both
 * can run at once without fetching a site twice.
 *
 * @module lib/outreach/services/checks
 */
import type { Json } from '@/types/database';

import { checkEmail, isDnsTimeout } from '../checks/email-check';
import {
  ApifyError,
  EST_CENTS_PER_PROFILE,
  estimateCostCents,
  fetchProfiles,
  getRun,
  MAX_HANDLES_PER_RUN,
  startProfileRun,
} from '../checks/instagram-apify';
import { checkWebsite, type WebsiteCheckResult } from '../checks/website';
import { normaliseInstagram } from '../import/normalise';
import { evaluateActivity, needsInstagramLookup } from '../score';
import type { AdminDb, CheckRow, Prospect, ProspectUpdate } from '../types';

import { recordEvents, type EventInput } from './events';
import { loadSettings } from './settings';

const WEBSITE_BATCH = 60;
const WEBSITE_CONCURRENCY = 20;
const EMAIL_BATCH = 100;
const PAGE = 1000;
/** Max ids per `.in()` filter, which PostgREST carries in the URL. */
const IN_CHUNK = 200;

/** Which prospects a new run covers. */
export interface RunScope {
  /** Explicit ids (from a bulk selection). */
  prospectIds?: string[];
  /** Otherwise every prospect with one of these verdicts. */
  verdicts?: ('unchecked' | 'active' | 'inactive' | 'needs_review')[];
}

/** Ids of prospects matching a scope, paged. */
async function scopeIds(db: AdminDb, scope: RunScope): Promise<string[]> {
  if (scope.prospectIds) return scope.prospectIds;
  const verdicts = scope.verdicts?.length ? scope.verdicts : ['unchecked'];
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('outreach_prospects').select('id').in('verdict', verdicts).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`scope: ${error.message}`);
    ids.push(...(data ?? []).map((r) => r.id));
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

/** Queue a website check (and an email check where there is an email) for each prospect. */
export async function startActivityRun(db: AdminDb, scope: RunScope): Promise<{ runId: string; total: number }> {
  const ids = await scopeIds(db, scope);
  const { data: run, error } = await db
    .from('outreach_check_runs')
    .insert({ kind: 'activity', scope: scope as Json, total: ids.length, status: 'queuing' })
    .select('id')
    .single();
  if (error || !run) throw new Error(`create run: ${error?.message}`);

  await whileQueuing(db, run.id, async () => {
    await queueActivityChecks(db, run.id, ids);
  });
  if (ids.length === 0) await finishRun(db, run.id);
  return { runId: run.id, total: ids.length };
}

/**
 * Run `queue`, then open the run for batches. Why: the run row has to
 * exist before its checks (foreign key), and a batch that saw a running
 * run with no checks yet would close it as finished, stranding every
 * check queued after. A failed queue marks the run failed instead of
 * leaving it half-built.
 */
async function whileQueuing(db: AdminDb, runId: string, queue: () => Promise<void>): Promise<void> {
  try {
    await queue();
  } catch (err) {
    await db.from('outreach_check_runs').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', runId);
    throw err;
  }
  const { error } = await db.from('outreach_check_runs').update({ status: 'running' }).eq('id', runId);
  if (error) throw new Error(`open run: ${error.message}`);
}

/** Insert the website (and, where there's an email, email) checks for an activity run. */
async function queueActivityChecks(db: AdminDb, runId: string, ids: string[]): Promise<void> {
  const run = { id: runId };
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE);
    const { error: e1 } = await db
      .from('outreach_checks')
      .insert(chunk.map((id) => ({ run_id: run.id, prospect_id: id, check: 'website' })));
    if (e1) throw new Error(`queue website checks: ${e1.message}`);
    // `.in()` goes in the URL: 1000 uuids is ~37KB and PostgREST answers
    // 400 Bad Request, so look the emails up 200 at a time like the rest of
    // this module does.
    const withEmail: { id: string }[] = [];
    for (let j = 0; j < chunk.length; j += IN_CHUNK) {
      const { data, error: e2 } = await db
        .from('outreach_prospects')
        .select('id')
        .in('id', chunk.slice(j, j + IN_CHUNK))
        .not('email', 'is', null);
      if (e2) throw new Error(`email lookup: ${e2.message}`);
      withEmail.push(...(data ?? []));
    }
    if (withEmail.length) {
      const { error: e3 } = await db
        .from('outreach_checks')
        .insert(withEmail.map((p) => ({ run_id: run.id, prospect_id: p.id, check: 'email' })));
      if (e3) throw new Error(`queue email checks: ${e3.message}`);
    }
  }
}

/** Queue lazy IG lookups for prospects about to get IG steps (never checked before). */
export async function queueEnrolmentIgLookups(db: AdminDb, prospectIds: string[]): Promise<void> {
  if (prospectIds.length === 0) return;
  const { data: run, error } = await db
    .from('outreach_check_runs')
    .insert({ kind: 'ig_enrolment', total: prospectIds.length, status: 'queuing' })
    .select('id')
    .single();
  if (error || !run) throw new Error(`create ig run: ${error?.message}`);
  await whileQueuing(db, run.id, async () => {
    const { error: e2 } = await db
      .from('outreach_checks')
      .insert(prospectIds.map((id) => ({ run_id: run.id, prospect_id: id, check: 'instagram' })));
    if (e2) throw new Error(`queue ig checks: ${e2.message}`);
  });
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

async function loadProspects(db: AdminDb, ids: string[]): Promise<Map<string, Prospect>> {
  const out = new Map<string, Prospect>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('outreach_prospects').select('*').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`load prospects: ${error.message}`);
    for (const p of data ?? []) out.set(p.id, p);
  }
  return out;
}

/**
 * Score a prospect from its stored signals and save score + verdict.
 * A manual verdict is never overwritten; only the score moves.
 */
export async function evaluateProspect(db: AdminDb, p: Prospect, events: EventInput[], now = new Date()): Promise<void> {
  const result = evaluateActivity({
    siteStatus: p.site_status as never,
    siteLatestYear: p.site_latest_year,
    siteHasWeddingContent: p.site_has_wedding_content,
    hasInstagramHandle: !!p.instagram_handle,
    igStatus: p.ig_status as never,
    igLastPostAt: p.ig_last_post_at,
    igFollowers: p.ig_followers,
  }, now);
  const patch: ProspectUpdate = { activity_score: result.score, updated_at: now.toISOString() };
  if (p.verdict_source !== 'manual') {
    patch.verdict = result.verdict;
    patch.verdict_reason = result.reason;
    patch.verdict_source = 'auto';
  }
  const { error } = await db.from('outreach_prospects').update(patch).eq('id', p.id);
  if (error) throw new Error(`save verdict: ${error.message}`);
  events.push({ prospectId: p.id, type: 'check_completed', payload: { score: result.score, verdict: result.verdict, reason: result.reason } });
  if (p.verdict_source !== 'manual' && p.verdict !== result.verdict) {
    events.push({ prospectId: p.id, type: 'verdict_changed', payload: { from: p.verdict, to: result.verdict, reason: result.reason } });
  }
}

/** Apply a website result: site fields, enrichment (blanks only), next step. */
async function applyWebsite(db: AdminDb, check: CheckRow, p: Prospect, r: WebsiteCheckResult, events: EventInput[]): Promise<void> {
  const now = new Date();
  const patch: ProspectUpdate = {
    site_status: r.status,
    site_latest_year: r.signals?.latestYear ?? null,
    site_has_wedding_content: r.signals?.weddingContent ?? null,
    site_checked_at: now.toISOString(),
  };
  let foundEmail = false;
  if (r.status === 'live' && r.signals) {
    if (!p.email && r.signals.emails[0]) {
      patch.email = r.signals.emails[0];
      patch.email_source = 'found';
      foundEmail = true;
      events.push({ prospectId: p.id, type: 'contact_found', payload: { field: 'email', value: patch.email } });
    }
    const handle = r.signals.instagramHandles[0];
    if (!p.instagram_handle && handle) {
      patch.instagram_handle = normaliseInstagram(handle);
      patch.instagram_source = 'found';
      events.push({ prospectId: p.id, type: 'contact_found', payload: { field: 'instagram', value: handle } });
    }
    if (!p.facebook_url && r.signals.facebookUrls[0]) {
      patch.facebook_url = r.signals.facebookUrls[0];
      events.push({ prospectId: p.id, type: 'contact_found', payload: { field: 'facebook', value: patch.facebook_url } });
    }
  }
  const { data: updated, error } = await db.from('outreach_prospects').update(patch).eq('id', p.id).select('*').single();
  if (error || !updated) throw new Error(`save site: ${error?.message}`);

  const { error: cErr } = await db
    .from('outreach_checks')
    .update({ status: r.error && r.status === 'http_error' ? 'error' : 'ok', result: r as unknown as Json, error: r.error, checked_at: now.toISOString() })
    .eq('id', check.id);
  if (cErr) throw new Error(`save check: ${cErr.message}`);

  if (foundEmail) {
    await db.from('outreach_checks').upsert(
      { run_id: check.run_id, prospect_id: p.id, check: 'email' },
      { onConflict: 'run_id,prospect_id,check', ignoreDuplicates: true },
    );
  }

  const wantsIg = needsInstagramLookup({
    siteStatus: updated.site_status as never,
    siteLatestYear: updated.site_latest_year,
    siteHasWeddingContent: updated.site_has_wedding_content,
    hasInstagramHandle: !!updated.instagram_handle,
  }, now);
  if (wantsIg) {
    const { error: qErr } = await db.from('outreach_checks').upsert(
      { run_id: check.run_id, prospect_id: p.id, check: 'instagram' },
      { onConflict: 'run_id,prospect_id,check', ignoreDuplicates: true },
    );
    if (qErr) throw new Error(`queue ig: ${qErr.message}`);
  } else {
    await evaluateProspect(db, updated, events, now);
  }
}

/** Claim and process one batch of website checks. Returns how many ran. */
async function processWebsites(db: AdminDb, deadline: number): Promise<number> {
  const { data: claimed, error } = await db.rpc('outreach_claim_checks', { p_check: 'website', p_limit: WEBSITE_BATCH });
  if (error) throw new Error(`claim website: ${error.message}`);
  if (!claimed?.length) return 0;
  const prospects = await loadProspects(db, claimed.map((c) => c.prospect_id));
  const events: EventInput[] = [];
  await pool(claimed, WEBSITE_CONCURRENCY, async (check) => {
    const p = prospects.get(check.prospect_id);
    if (!p) return;
    // Past the deadline, leave the claim to expire and be retried.
    if (Date.now() > deadline) return;
    const result = await checkWebsite(p.website);
    await applyWebsite(db, check, p, result, events);
  });
  await recordEvents(db, events);
  return claimed.length;
}

/**
 * Claim and process one batch of email checks.
 *
 * Past `deadline` no new lookup starts; those claims expire and are
 * retried, as in {@link processWebsites}.
 */
async function processEmails(db: AdminDb, deadline: number): Promise<number> {
  const { data: claimed, error } = await db.rpc('outreach_claim_checks', { p_check: 'email', p_limit: EMAIL_BATCH });
  if (error) throw new Error(`claim email: ${error.message}`);
  if (!claimed?.length) return 0;
  const prospects = await loadProspects(db, claimed.map((c) => c.prospect_id));
  const events: EventInput[] = [];
  await pool(claimed, 20, async (check) => {
    if (Date.now() > deadline) return;
    const p = prospects.get(check.prospect_id);
    const now = new Date().toISOString();
    if (!p?.email) {
      await db.from('outreach_checks').update({ status: 'skipped', checked_at: now }).eq('id', check.id);
      return;
    }
    // A bounced address is known dead; a DNS pass can't revive it.
    if (p.email_check === 'bounced') {
      await db.from('outreach_checks').update({ status: 'skipped', checked_at: now }).eq('id', check.id);
      return;
    }
    try {
      const result = await checkEmail(p.email);
      await db.from('outreach_prospects').update({ email_check: result, email_checked_at: now }).eq('id', p.id);
      await db.from('outreach_checks').update({ status: 'ok', result: { result } as Json, checked_at: now }).eq('id', check.id);
      events.push({ prospectId: p.id, type: 'email_checked', channel: 'email', payload: { result } });
    } catch (err) {
      const error = String(err).slice(0, 200);
      if (isDnsTimeout(err)) {
        // A nameserver that never answers keeps never answering. Requeued,
        // the same domain was claimed again and again, each try stalling
        // the tick and holding its run open. Settled as an error instead:
        // the address stays unjudged and the run can finish.
        await db.from('outreach_checks').update({ status: 'error', error, checked_at: now }).eq('id', check.id);
        return;
      }
      // Other transient DNS trouble: release the claim so a later batch retries.
      await db.from('outreach_checks').update({ status: 'pending', claimed_at: null, error }).eq('id', check.id);
    }
  });
  await recordEvents(db, events);
  return claimed.length;
}

/**
 * Mark the remaining IG checks of a run skipped (monthly cap reached, or
 * Apify not configured) and score those prospects. They land in Needs
 * review rather than being guessed at.
 */
async function skipIgForBudget(db: AdminDb, runId: string, reason: 'monthly_budget' | 'apify_not_configured' = 'monthly_budget'): Promise<void> {
  const { data, error } = await db
    .from('outreach_checks')
    .update({ status: 'skipped', error: reason, checked_at: new Date().toISOString() })
    .eq('run_id', runId)
    .eq('check', 'instagram')
    .eq('status', 'pending')
    .select('prospect_id');
  if (error) throw new Error(`skip ig: ${error.message}`);
  const ids = (data ?? []).map((r) => r.prospect_id);
  const prospects = await loadProspects(db, ids);
  const events: EventInput[] = ids.map((id) => ({ prospectId: id, type: 'ig_lookup_skipped_budget' as const, payload: { reason } }));
  for (const p of prospects.values()) await evaluateProspect(db, p, events);
  await recordEvents(db, events);
}

/**
 * Advance one run's Instagram phase by one step: finish an in-flight Apify
 * run, or start the next batch. The batch loop calls this for every running
 * run; it is exported so a single run can be driven on its own (tests, and
 * a future per-run "retry" action). Safe to call concurrently for the same run.
 */
export async function advanceInstagramForRun(db: AdminDb, runId: string): Promise<void> {
  const { data: run, error } = await db.from('outreach_check_runs').select('id, kind, apify_run_id, cost_cents').eq('id', runId).single();
  if (error || !run) throw new Error(`run ${runId}: ${error?.message ?? 'not found'}`);
  await advanceInstagram(db, run);
}

/** A check run row as the Instagram phase reads it. */
interface RunRow {
  id: string;
  kind: string;
  apify_run_id: string | null;
  cost_cents: number;
}

/** What `outreach_start_ig_batch` returned. Only "started" carries checks to run. */
interface StartClaim {
  status: 'started' | 'in_flight' | 'budget' | 'empty' | 'not_running';
  check_ids?: string[];
}

/** Ids per `.in()` / `.update().in()` call, so the URL stays short. */
const ID_CHUNK = 200;

/** Read checks by id, chunked. */
async function fetchChecks(db: AdminDb, ids: string[]): Promise<{ id: string; prospect_id: string }[]> {
  const out: { id: string; prospect_id: string }[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db.from('outreach_checks').select('id, prospect_id').in('id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`load checks: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

/** Update checks by id, chunked. */
async function updateChecks(db: AdminDb, ids: string[], patch: { status: string; claimed_at?: null; checked_at?: string; error?: string | null }): Promise<void> {
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { error } = await db.from('outreach_checks').update(patch).in('id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`update checks: ${error.message}`);
  }
}

/**
 * Settle a run's open reservation at its real cost (0 when nothing ran) and
 * clear its Apify id. One RPC, so spend is never half-recorded.
 */
async function settleBatch(db: AdminDb, runId: string, actualCents: number): Promise<void> {
  const { error } = await db.rpc('outreach_settle_ig_batch', { p_run: runId, p_actual_cents: actualCents });
  if (error) throw new Error(`settle ig batch: ${error.message}`);
}

/**
 * Drive one run's Instagram phase: finish an in-flight Apify run, or start
 * the next batch once the website phase has drained (one larger run is
 * cheaper and faster than many small ones), inside the monthly cap.
 */
async function advanceInstagram(db: AdminDb, run: RunRow): Promise<void> {
  if (run.apify_run_id) {
    const apify = await getRun(run.apify_run_id);
    if (apify.status === 'RUNNING' || apify.status === 'READY') return;
    await finishInstagramRun(db, { id: run.id, apify_run_id: run.apify_run_id, cost_cents: run.cost_cents }, apify);
    return;
  }
  await startInstagramBatch(db, run);
}

/**
 * Write a finished Apify run's results and settle its spend.
 *
 * Why the compare-and-swap on apify_run_id: the tick and an open Prospects page
 * can both see the run finish. Only the caller that clears the id writes
 * results, so no profile is scored twice and no event is doubled.
 */
async function finishInstagramRun(
  db: AdminDb,
  run: { id: string; apify_run_id: string; cost_cents: number },
  apify: { id: string; status: string; datasetId: string; usageTotalUsd: number | null },
): Promise<void> {
  const { data: won, error: casErr } = await db
    .from('outreach_check_runs')
    .update({ apify_run_id: null })
    .eq('id', run.id)
    .eq('apify_run_id', run.apify_run_id)
    .select('id');
  if (casErr) throw new Error(`claim finish: ${casErr.message}`);
  if (!won?.length) return;

  const { data: inFlight, error } = await db
    .from('outreach_checks')
    .select('id, prospect_id')
    .eq('run_id', run.id).eq('check', 'instagram').eq('status', 'claimed');
  if (error) throw new Error(`ig in flight: ${error.message}`);
  const checks = inFlight ?? [];
  // Why the estimate fallback: a run can finish without usage data, and spend must still be counted.
  const costCents = apify.usageTotalUsd !== null ? Math.ceil(apify.usageTotalUsd * 100) : estimateCostCents(checks.length);

  if (apify.status !== 'SUCCEEDED') {
    // Release the claims for a later attempt and record the spend anyway.
    await updateChecks(db, checks.map((c) => c.id), { status: 'pending', claimed_at: null, error: `apify ${apify.status}` });
    await settleBatch(db, run.id, costCents);
    await db.from('outreach_check_runs').update({ errors: checks.length }).eq('id', run.id);
    throw new ApifyError(`Apify run ${apify.id} ended ${apify.status}`);
  }

  try {
    await recordProfiles(db, apify.datasetId, checks);
    await settleBatch(db, run.id, costCents);
  } catch (err) {
    // Put the id back so the next tick retries the finish instead of stranding the reservation.
    await db.from('outreach_check_runs').update({ apify_run_id: run.apify_run_id }).eq('id', run.id);
    throw err;
  }
}

/** Score each claimed prospect from the Apify dataset. A check whose prospect lost its handle is skipped, not left claimed. */
async function recordProfiles(db: AdminDb, datasetId: string, checks: { id: string; prospect_id: string }[]): Promise<void> {
  const profiles = await fetchProfiles(datasetId);
  const prospects = await loadProspects(db, checks.map((c) => c.prospect_id));
  const events: EventInput[] = [];
  const now = new Date().toISOString();
  for (const check of checks) {
    const p = prospects.get(check.prospect_id);
    if (!p?.instagram_handle) {
      await updateChecks(db, [check.id], { status: 'skipped', checked_at: now });
      continue;
    }
    const profile = profiles.get(p.instagram_handle);
    const patch: ProspectUpdate = profile
      ? {
          ig_status: profile.status,
          ig_last_post_at: profile.lastPostAt,
          ig_followers: profile.followers,
          ig_posts: profile.posts,
          ig_bio: profile.bio,
          ig_is_private: profile.isPrivate,
          ig_checked_at: now,
        }
      : { ig_status: 'not_found', ig_checked_at: now };
    const { data: updated, error: upErr } = await db.from('outreach_prospects').update(patch).eq('id', p.id).select('*').single();
    if (upErr || !updated) throw new Error(`save ig: ${upErr?.message}`);
    await updateChecks(db, [check.id], { status: 'ok', checked_at: now });
    await db.from('outreach_checks').update({ result: (profile ?? { status: 'not_found' }) as unknown as Json }).eq('id', check.id);
    await evaluateProspect(db, updated, events);
  }
  await recordEvents(db, events);
}

/**
 * Start the next Apify batch for a run that has none in flight.
 *
 * The budget read, the one-run-in-flight check and the claim all happen in
 * `outreach_start_ig_batch` under a lock, and Apify is called only after
 * that commits. So two batches can't both start a run for the same checks,
 * and an in-flight run is already counted against the cap.
 */
async function startInstagramBatch(db: AdminDb, run: RunRow): Promise<void> {
  const { count: pendingIg } = await db
    .from('outreach_checks')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', run.id).eq('check', 'instagram').eq('status', 'pending');
  if (!pendingIg) return;

  if (run.kind === 'activity') {
    const { count: websitesLeft } = await db
      .from('outreach_checks')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', run.id).eq('check', 'website').in('status', ['pending', 'claimed']);
    // Wait for the website phase unless a full Apify batch is already queued.
    if ((websitesLeft ?? 0) > 0 && pendingIg < MAX_HANDLES_PER_RUN) return;
  }

  // Without a token every run would throw forever and the check would
  // never finish; treat it like a spent budget instead.
  if (!process.env.APIFY_TOKEN) {
    await skipIgForBudget(db, run.id, 'apify_not_configured');
    return;
  }
  const settings = await loadSettings(db);
  const { data, error } = await db.rpc('outreach_start_ig_batch', {
    p_run: run.id,
    p_max: MAX_HANDLES_PER_RUN,
    p_budget_cents: settings.apify_monthly_budget_cents,
    p_cents_per_profile: EST_CENTS_PER_PROFILE,
  });
  if (error) throw new Error(`start ig batch: ${error.message}`);
  // Our own RPC's jsonb result; the status field decides what happens next.
  const claim = data as unknown as StartClaim | null;
  if (claim?.status === 'budget') {
    await skipIgForBudget(db, run.id);
    return;
  }
  if (claim?.status !== 'started' || !claim.check_ids?.length) return;
  await launchApifyBatch(db, run.id, claim.check_ids);
}

/** Start the Apify run for claimed checks, then record its id on the run. */
async function launchApifyBatch(db: AdminDb, runId: string, checkIds: string[]): Promise<void> {
  const checks = await fetchChecks(db, checkIds);
  const prospects = await loadProspects(db, checks.map((c) => c.prospect_id));
  const handles = [...new Set([...prospects.values()].map((p) => p.instagram_handle).filter((h): h is string => !!h))];
  if (handles.length === 0) {
    await updateChecks(db, checkIds, { status: 'skipped', checked_at: new Date().toISOString() });
    await settleBatch(db, runId, 0);
    return;
  }
  let apifyRun: Awaited<ReturnType<typeof startProfileRun>>;
  try {
    apifyRun = await startProfileRun(handles);
  } catch (err) {
    // Nothing started: give the claims back and release the reservation.
    await updateChecks(db, checkIds, { status: 'pending', claimed_at: null, error: 'apify start failed' });
    await settleBatch(db, runId, 0);
    throw err;
  }
  const { error } = await db.from('outreach_check_runs').update({ apify_run_id: apifyRun.id }).eq('id', runId);
  if (error) throw new Error(`record apify run: ${error.message}`);
}

/** Recount progress and close the run when nothing is left. */
async function refreshRun(db: AdminDb, runId: string, kind: string): Promise<void> {
  const count = async (check: string, statuses: string[]) => {
    const { count: c, error } = await db
      .from('outreach_checks')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', runId).eq('check', check).in('status', statuses);
    if (error) throw new Error(`count: ${error.message}`);
    return c ?? 0;
  };
  const igOpen = await count('instagram', ['pending', 'claimed']);
  const emailOpen = await count('email', ['pending', 'claimed']);
  const webOpen = kind === 'activity' ? await count('website', ['pending', 'claimed']) : 0;
  const webDone = kind === 'activity' ? await count('website', ['ok', 'error', 'skipped']) : 0;
  const igDone = await count('instagram', ['ok', 'error', 'skipped']);
  const { count: errors } = await db.from('outreach_checks').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('status', 'error');
  const done = kind === 'activity' ? Math.max(0, webDone - igOpen) : igDone;
  const patch: { done: number; errors: number; status?: string; finished_at?: string } = { done, errors: errors ?? 0 };
  if (igOpen + emailOpen + webOpen === 0) {
    patch.status = 'done';
    patch.finished_at = new Date().toISOString();
  }
  const { error } = await db.from('outreach_check_runs').update(patch).eq('id', runId);
  if (error) throw new Error(`refresh run: ${error.message}`);
}

async function finishRun(db: AdminDb, runId: string): Promise<void> {
  await db.from('outreach_check_runs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', runId);
}

/** Progress of one batch call, for the Prospects page's loop. */
export interface BatchProgress {
  websites: number;
  emails: number;
  /** True while any run still has work. */
  active: boolean;
}

/**
 * Advance every running check run by one batch, stopping new work at
 * `deadline` (epoch ms).
 */
export async function processCheckBatch(db: AdminDb, deadline: number): Promise<BatchProgress> {
  const websites = Date.now() < deadline ? await processWebsites(db, deadline) : 0;
  const emails = Date.now() < deadline ? await processEmails(db, deadline) : 0;

  const { data: runs, error } = await db
    .from('outreach_check_runs')
    .select('id, kind, apify_run_id, cost_cents')
    .eq('status', 'running');
  if (error) throw new Error(`runs: ${error.message}`);
  let firstError: unknown = null;
  for (const run of runs ?? []) {
    try {
      if (Date.now() < deadline) await advanceInstagram(db, run);
    } catch (err) {
      firstError ??= err;
    }
    await refreshRun(db, run.id, run.kind);
  }
  if (firstError) throw firstError;

  // A queuing run counts as active, so the Prospects page keeps driving
  // through the moment between "run created" and "checks queued".
  const { count } = await db.from('outreach_check_runs').select('id', { count: 'exact', head: true }).in('status', ['queuing', 'running']);
  return { websites, emails, active: (count ?? 0) > 0 };
}

/** Cancel a run: drop its open checks. Already-scored prospects keep their results. */
export async function cancelRun(db: AdminDb, runId: string): Promise<void> {
  await db.from('outreach_checks').update({ status: 'skipped' }).eq('run_id', runId).in('status', ['pending', 'claimed']);
  const { error } = await db.from('outreach_check_runs').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', runId);
  if (error) throw new Error(`cancel run: ${error.message}`);
}
