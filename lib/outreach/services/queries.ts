/**
 * Read models for the Outreach admin views.
 *
 * Each function returns exactly what one view renders, so the server
 * actions stay one-liners and the views never shape raw rows.
 *
 * @module lib/outreach/services/queries
 */
import { computeAnalytics, type AnalyticsReport, type EnrollmentFact, type MessageFact, type OutcomeFact } from '../analytics/compute';
import { CAP_TIMEZONE, localDateKey, localParts, rampCap, zonedTimeToUtc } from '../sequencer/schedule';
import type { AdminDb, Campaign, CheckRun, OutreachEvent, OutreachMessage, OutreachSettings, Prospect, Sequence, SequenceStep, Variant } from '../types';

import { apifySpendThisMonth, bookingBaseUrl, loadMailboxInfo, loadSettings, type MailboxInfo } from './settings';

const PAGE = 1000;

function sydneyDayStart(date = new Date()): string {
  const p = localParts(date, CAP_TIMEZONE);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, CAP_TIMEZONE).toISOString();
}

function sydneyDayEnd(date = new Date()): string {
  return new Date(Date.parse(sydneyDayStart(date)) + 86_400_000).toISOString();
}

/** Count prospects, optionally where `column` equals (or, with `not`, differs from) `value`. */
async function countProspects(db: AdminDb, where?: { column: 'verdict' | 'stage'; value: string; not?: boolean }): Promise<number> {
  let q = db.from('outreach_prospects').select('id', { count: 'exact', head: true });
  if (where) q = where.not ? q.neq(where.column, where.value) : q.eq(where.column, where.value);
  const { count: c, error } = await q;
  if (error) throw new Error(`count prospects: ${error.message}`);
  return c ?? 0;
}

/**
 * PostgREST filter that drops events still waiting for the founder to
 * confirm them: a public booking matched to a prospect only by the email
 * typed into the form, which anyone could enter. Written as an OR with
 * IS NULL because a plain "not equal true" also drops every event with no
 * flag at all (NULL is never unequal in SQL).
 */
const CONFIRMED_ONLY = 'payload->>needs_confirmation.is.null,payload->>needs_confirmation.neq.true';

/** Distinct prospects that have any event of the given types (paged). */
async function prospectsWithEvent(db: AdminDb, types: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('outreach_events').select('prospect_id').in('type', types)
      .or(CONFIRMED_ONLY).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`events ${types.join(',')}: ${error.message}`);
    for (const r of data ?? []) if (r.prospect_id) out.add(r.prospect_id);
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// ───── Overview / funnel ──────────────────────────────────────────────

/** Headline funnel across all prospects. */
export interface Funnel {
  total: number;
  checked: number;
  active: number;
  needsReview: number;
  contacted: number;
  replied: number;
  demoBooked: number;
  demoDone: number;
  signedUp: number;
  paying: number;
  lost: number;
  optedOut: number;
}

/**
 * Funnel counts. Outcome stages are counted from events ("ever reached"),
 * so a prospect later marked lost still counts as having replied.
 */
export async function loadFunnel(db: AdminDb): Promise<Funnel> {
  const [total, checked, active, needsReview, lost, optedOut] = await Promise.all([
    countProspects(db),
    countProspects(db, { column: 'verdict', value: 'unchecked', not: true }),
    countProspects(db, { column: 'verdict', value: 'active' }),
    countProspects(db, { column: 'verdict', value: 'needs_review' }),
    countProspects(db, { column: 'stage', value: 'lost' }),
    countProspects(db, { column: 'stage', value: 'opted_out' }),
  ]);
  const [contacted, replied, demoBooked, demoDone, signedUp, paying] = await Promise.all([
    prospectsWithEvent(db, ['email_sent', 'ig_sent']),
    prospectsWithEvent(db, ['replied']),
    prospectsWithEvent(db, ['demo_booked']),
    prospectsWithEvent(db, ['demo_done']),
    prospectsWithEvent(db, ['signed_up']),
    prospectsWithEvent(db, ['paying']),
  ]);
  return {
    total, checked, active, needsReview, lost, optedOut,
    contacted: contacted.size, replied: replied.size, demoBooked: demoBooked.size,
    demoDone: demoDone.size, signedUp: signedUp.size, paying: paying.size,
  };
}

// ───── Today ──────────────────────────────────────────────────────────

/** A DM waiting in today's IG queue. */
export interface IgQueueItem {
  messageId: string;
  prospectId: string;
  name: string;
  handle: string;
  igStatus: string | null;
  body: string;
  scheduledFor: string;
  overdue: boolean;
  /** Position of the step in its sequence (1-based), shown as "Sequence step N". */
  step: number;
  score: number | null;
  /**
   * When the founder last copied this DM (an `ig_copied` event), or null.
   * Lives on the server so a reload does not forget it: forgetting it is
   * how a DM ends up sent twice.
   */
  copiedAt: string | null;
}

/** An item in "Needs attention". */
export interface AttentionItem {
  eventId: number;
  prospectId: string;
  name: string;
  type: string;
  at: string;
  snippet: string | null;
}

/** Everything the Today view shows. */
export interface TodayData {
  igQueue: IgQueueItem[];
  igCap: number;
  igSentToday: number;
  emailCap: number;
  emailSentToday: number;
  emailQueue: { messageId: string; prospectId: string; name: string; subject: string | null; scheduledFor: string }[];
  attention: AttentionItem[];
  awaitingIgReply: { prospectId: string; name: string; handle: string; lastDmAt: string }[];
  failed: { messageId: string; prospectId: string; name: string; error: string | null }[];
  upcomingDemos: { prospectId: string; name: string; startsAt: string }[];
  sendingPaused: boolean;
  pausedReason: string | null;
  mailboxConnected: boolean;
}

async function namesFor(db: AdminDb, ids: string[]): Promise<Map<string, Pick<Prospect, 'id' | 'full_name' | 'instagram_handle' | 'ig_status' | 'activity_score'>>> {
  const out = new Map<string, Pick<Prospect, 'id' | 'full_name' | 'instagram_handle' | 'ig_status' | 'activity_score'>>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await db.from('outreach_prospects').select('id, full_name, instagram_handle, ig_status, activity_score').in('id', unique.slice(i, i + 200));
    if (error) throw new Error(`names: ${error.message}`);
    for (const p of data ?? []) out.set(p.id, p);
  }
  return out;
}

/** Load the Today view. */
export async function loadToday(db: AdminDb): Promise<TodayData> {
  const settings = await loadSettings(db);
  const mailbox = await loadMailboxInfo(db);
  const dayStart = sydneyDayStart();
  const dayEnd = sydneyDayEnd();
  const now = new Date().toISOString();

  const { data: ig, error: igErr } = await db
    .from('outreach_messages')
    .select('id, prospect_id, body, scheduled_for, step_id')
    .eq('channel', 'instagram').eq('status', 'scheduled').lt('scheduled_for', dayEnd)
    .order('scheduled_for');
  if (igErr) throw new Error(`ig queue: ${igErr.message}`);

  const { data: emails, error: eErr } = await db
    .from('outreach_messages')
    .select('id, prospect_id, subject, scheduled_for')
    .eq('channel', 'email').eq('status', 'scheduled').lt('scheduled_for', dayEnd)
    .order('scheduled_for').limit(100);
  if (eErr) throw new Error(`email queue: ${eErr.message}`);

  const sentCount = async (channel: string) => {
    const { count: c } = await db.from('outreach_messages').select('id', { count: 'exact', head: true })
      .eq('channel', channel).eq('status', 'sent').gte('sent_at', dayStart);
    return c ?? 0;
  };

  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: attention, error: aErr } = await db
    .from('outreach_events')
    .select('id, prospect_id, type, occurred_at, payload')
    .in('type', ['replied', 'opted_out', 'email_bounced', 'demo_booked', 'email_failed'])
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(50);
  if (aErr) throw new Error(`attention: ${aErr.message}`);

  // People whose last touch was an IG DM and who haven't replied: candidates for "Replied on IG".
  const { data: igSent } = await db
    .from('outreach_messages')
    .select('prospect_id, sent_at, enrollment_id')
    .eq('channel', 'instagram').eq('status', 'sent')
    .gte('sent_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order('sent_at', { ascending: false }).limit(200);
  const igSentIds = [...new Set((igSent ?? []).map((m) => m.prospect_id))];
  const { data: stillOpen } = igSentIds.length
    ? await db.from('outreach_prospects').select('id').in('id', igSentIds).in('stage', ['contacted', 'new'])
    : { data: [] as { id: string }[] };
  const openSet = new Set((stillOpen ?? []).map((p) => p.id));

  const { data: failed } = await db.from('outreach_messages').select('id, prospect_id, error').eq('status', 'failed').order('created_at', { ascending: false }).limit(20);

  const { data: demos } = settings.booking_meeting_type_id
    ? await db.from('bookings').select('email, starts_at, source_ref').eq('meeting_type_id', settings.booking_meeting_type_id)
        .eq('status', 'confirmed').gte('starts_at', now).order('starts_at').limit(20)
    : { data: [] as { email: string; starts_at: string; source_ref: string | null }[] };
  const demoEmails = (demos ?? []).map((d) => d.email.toLowerCase());
  const { data: demoProspects } = demoEmails.length
    ? await db.from('outreach_prospects').select('id, full_name, email').in('email', demoEmails)
    : { data: [] as { id: string; full_name: string; email: string | null }[] };

  const names = await namesFor(db, [
    ...(ig ?? []).map((m) => m.prospect_id), ...(emails ?? []).map((m) => m.prospect_id),
    ...(attention ?? []).map((a) => a.prospect_id ?? '').filter(Boolean), ...openSet, ...(failed ?? []).map((f) => f.prospect_id),
  ]);
  const { data: steps } = (ig ?? []).length
    ? await db.from('outreach_sequence_steps').select('id, position').in('id', [...new Set((ig ?? []).map((m) => m.step_id))])
    : { data: [] as { id: string; position: number }[] };
  const stepPos = new Map((steps ?? []).map((s) => [s.id, s.position]));

  // Copy events for the queued DMs, newest first, so the first hit per message is its latest copy.
  const { data: copies } = (ig ?? []).length
    ? await db.from('outreach_events').select('message_id, occurred_at').eq('type', 'ig_copied')
        .in('message_id', (ig ?? []).map((m) => m.id)).order('occurred_at', { ascending: false })
    : { data: [] as { message_id: string | null; occurred_at: string }[] };
  const copiedAt = new Map<string, string>();
  for (const c of copies ?? []) if (c.message_id && !copiedAt.has(c.message_id)) copiedAt.set(c.message_id, c.occurred_at);

  const todayKey = localDateKey(new Date(), CAP_TIMEZONE);
  const seenOpen = new Set<string>();
  return {
    igQueue: (ig ?? []).map((m) => {
      const p = names.get(m.prospect_id);
      return {
        messageId: m.id, prospectId: m.prospect_id, name: p?.full_name ?? 'Unknown', handle: p?.instagram_handle ?? '',
        igStatus: p?.ig_status ?? null, body: m.body, scheduledFor: m.scheduled_for, overdue: m.scheduled_for < dayStart,
        step: stepPos.get(m.step_id) ?? 0, score: p?.activity_score ?? null, copiedAt: copiedAt.get(m.id) ?? null,
      };
    }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (b.score ?? 0) - (a.score ?? 0)),
    igCap: settings.ig_daily_cap,
    igSentToday: await sentCount('instagram'),
    emailCap: rampCap(todayKey, settings.ramp_started_on, settings.email_ramp, settings.email_daily_cap),
    emailSentToday: await sentCount('email'),
    emailQueue: (emails ?? []).map((m) => ({
      messageId: m.id, prospectId: m.prospect_id, name: names.get(m.prospect_id)?.full_name ?? 'Unknown', subject: m.subject, scheduledFor: m.scheduled_for,
    })),
    attention: (attention ?? []).filter((a) => a.prospect_id).map((a) => ({
      eventId: a.id, prospectId: a.prospect_id!, name: names.get(a.prospect_id!)?.full_name ?? 'Unknown', type: a.type, at: a.occurred_at,
      snippet: (a.payload as { snippet?: string } | null)?.snippet ?? null,
    })),
    awaitingIgReply: (igSent ?? []).filter((m) => openSet.has(m.prospect_id) && !seenOpen.has(m.prospect_id) && seenOpen.add(m.prospect_id)).map((m) => ({
      prospectId: m.prospect_id, name: names.get(m.prospect_id)?.full_name ?? 'Unknown', handle: names.get(m.prospect_id)?.instagram_handle ?? '', lastDmAt: m.sent_at!,
    })),
    failed: (failed ?? []).map((f) => ({ messageId: f.id, prospectId: f.prospect_id, name: names.get(f.prospect_id)?.full_name ?? 'Unknown', error: f.error })),
    upcomingDemos: (demos ?? []).flatMap((d) => {
      const p = (demoProspects ?? []).find((x) => x.email?.toLowerCase() === d.email.toLowerCase());
      return p ? [{ prospectId: p.id, name: p.full_name, startsAt: d.starts_at }] : [];
    }),
    sendingPaused: settings.sending_paused,
    pausedReason: settings.paused_reason,
    mailboxConnected: !!mailbox,
  };
}

// ───── Prospects ──────────────────────────────────────────────────────

/** Prospect list filters. */
export interface ProspectFilters {
  search?: string | undefined;
  verdict?: string | undefined;
  stage?: string | undefined;
  state?: string | undefined;
  minScore?: number | undefined;
  hasEmail?: boolean | undefined;
  hasInstagram?: boolean | undefined;
  page: number;
  pageSize: number;
}

/** A row in the Prospects table. */
export type ProspectRow = Pick<Prospect,
  'id' | 'full_name' | 'state' | 'suburb' | 'email' | 'email_source' | 'email_check' | 'instagram_handle' | 'instagram_source' |
  'website' | 'verdict' | 'verdict_reason' | 'activity_score' | 'stage' | 'do_not_contact' | 'ig_last_post_at' | 'ig_followers' | 'site_status'>;

const ROW_COLUMNS = 'id, full_name, state, suburb, email, email_source, email_check, instagram_handle, instagram_source, website, verdict, verdict_reason, activity_score, stage, do_not_contact, ig_last_post_at, ig_followers, site_status';

/** One page of prospects. */
export async function listProspects(db: AdminDb, f: ProspectFilters): Promise<{ rows: ProspectRow[]; total: number }> {
  let q = db.from('outreach_prospects').select(ROW_COLUMNS, { count: 'exact' });
  if (f.search) {
    const s = f.search.replace(/[%,()]/g, ' ').trim();
    if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,suburb.ilike.%${s}%,instagram_handle.ilike.%${s}%`);
  }
  if (f.verdict) q = q.eq('verdict', f.verdict);
  if (f.stage) q = q.eq('stage', f.stage);
  if (f.state) q = q.eq('state', f.state);
  if (f.minScore !== undefined) q = q.gte('activity_score', f.minScore);
  if (f.hasEmail) q = q.not('email', 'is', null);
  if (f.hasInstagram) q = q.not('instagram_handle', 'is', null);
  const from = f.page * f.pageSize;
  const { data, error, count: total } = await q
    .order('activity_score', { ascending: false, nullsFirst: false })
    .order('full_name')
    .range(from, from + f.pageSize - 1);
  if (error) throw new Error(`list prospects: ${error.message}`);
  return { rows: data ?? [], total: total ?? 0 };
}

/** Everything the prospect modal shows. */
export interface ProspectDetail {
  prospect: Prospect;
  events: OutreachEvent[];
  messages: (OutreachMessage & { step_position: number | null })[];
  enrollment: { id: string; campaign: string; sequence: string; status: string; stop_reason: string | null } | null;
}

/** Load one prospect with its timeline. */
export async function loadProspect(db: AdminDb, id: string): Promise<ProspectDetail> {
  const [{ data: prospect, error }, { data: events }, { data: messages }, { data: enrollments }] = await Promise.all([
    db.from('outreach_prospects').select('*').eq('id', id).single(),
    db.from('outreach_events').select('*').eq('prospect_id', id).order('occurred_at', { ascending: false }).limit(300),
    db.from('outreach_messages').select('*').eq('prospect_id', id).order('created_at', { ascending: false }),
    db.from('outreach_enrollments').select('id, status, stop_reason, campaign_id, sequence_id').eq('prospect_id', id).order('enrolled_at', { ascending: false }).limit(1),
  ]);
  if (error || !prospect) throw new Error('Prospect not found.');
  const stepIds = [...new Set((messages ?? []).map((m) => m.step_id))];
  const { data: steps } = stepIds.length ? await db.from('outreach_sequence_steps').select('id, position').in('id', stepIds) : { data: [] as { id: string; position: number }[] };
  const pos = new Map((steps ?? []).map((s) => [s.id, s.position]));
  let enrollment: ProspectDetail['enrollment'] = null;
  const e = enrollments?.[0];
  if (e) {
    const [{ data: c }, { data: s }] = await Promise.all([
      db.from('outreach_campaigns').select('name').eq('id', e.campaign_id).single(),
      db.from('outreach_sequences').select('name').eq('id', e.sequence_id).single(),
    ]);
    enrollment = { id: e.id, campaign: c?.name ?? '', sequence: s?.name ?? '', status: e.status, stop_reason: e.stop_reason };
  }
  return {
    prospect,
    events: events ?? [],
    messages: (messages ?? []).map((m) => ({ ...m, step_position: pos.get(m.step_id) ?? null })),
    enrollment,
  };
}

// ───── Checks ─────────────────────────────────────────────────────────

/**
 * The Prospects page's header data: runs, spend, the review queue size, and
 * `total`, the unfiltered prospect count. `total === 0` is what decides the
 * first-run empty state, so it must not depend on any filter.
 */
export interface ChecksData {
  runs: CheckRun[];
  spentCentsThisMonth: number;
  budgetCents: number;
  total: number;
  counts: { unchecked: number; active: number; inactive: number; needsReview: number };
}

/** Load the Checks view. */
export async function loadChecks(db: AdminDb): Promise<ChecksData> {
  const settings = await loadSettings(db);
  const { data: runs, error } = await db.from('outreach_check_runs').select('*').order('started_at', { ascending: false }).limit(20);
  if (error) throw new Error(`runs: ${error.message}`);
  const v = (verdict: string) => countProspects(db, { column: 'verdict', value: verdict });
  return {
    runs: runs ?? [],
    spentCentsThisMonth: await apifySpendThisMonth(db),
    budgetCents: settings.apify_monthly_budget_cents,
    total: await countProspects(db),
    counts: { unchecked: await v('unchecked'), active: await v('active'), inactive: await v('inactive'), needsReview: await v('needs_review') },
  };
}

/** Next prospects in the Needs-review queue. */
export async function loadReviewQueue(db: AdminDb, limit = 25): Promise<Prospect[]> {
  const { data, error } = await db.from('outreach_prospects').select('*').eq('verdict', 'needs_review').order('activity_score', { ascending: false, nullsFirst: false }).limit(limit);
  if (error) throw new Error(`review queue: ${error.message}`);
  return data ?? [];
}

// ───── Sequences + campaigns ──────────────────────────────────────────

/**
 * A sequence with its steps and variants. The usage counts gate editing:
 * the server refuses archiving while `campaign_count` is above zero, and
 * refuses removing a step with `sent_count` above zero.
 */
export interface SequenceWithSteps extends Sequence {
  /** Campaigns that run this sequence. */
  campaign_count: number;
  steps: (SequenceStep & {
    sent_count: number;
    variants: (Variant & { sent_count: number })[];
  })[];
}

/**
 * Sent-message count per step or variant id. One head count per id:
 * PostgREST has no GROUP BY here, and fetching every message row would
 * hit the default row cap and silently undercount.
 */
async function sentCounts(db: AdminDb, column: 'step_id' | 'variant_id', ids: string[]): Promise<Map<string, number>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await db.from('outreach_messages').select('id', { count: 'exact', head: true }).eq(column, id);
      if (error) throw new Error(`sent counts: ${error.message}`);
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(entries);
}

/** All non-archived sequences, fully loaded, with their usage counts. */
export async function loadSequences(db: AdminDb): Promise<SequenceWithSteps[]> {
  const { data: seqs, error } = await db.from('outreach_sequences').select('*').is('archived_at', null).order('created_at');
  if (error) throw new Error(`sequences: ${error.message}`);
  const ids = (seqs ?? []).map((s) => s.id);
  if (ids.length === 0) return [];
  const { data: steps } = await db.from('outreach_sequence_steps').select('*').in('sequence_id', ids).order('position');
  const stepIds = (steps ?? []).map((s) => s.id);
  const { data: variants } = stepIds.length ? await db.from('outreach_variants').select('*').in('step_id', stepIds).order('label') : { data: [] as Variant[] };
  // Campaigns are counted distinct: one campaign with two arms on the same sequence is still one.
  const { data: arms } = await db.from('outreach_campaign_arms').select('sequence_id, campaign_id').in('sequence_id', ids);
  const campaignsBySeq = new Map<string, Set<string>>();
  for (const arm of arms ?? []) {
    const set = campaignsBySeq.get(arm.sequence_id) ?? new Set<string>();
    set.add(arm.campaign_id);
    campaignsBySeq.set(arm.sequence_id, set);
  }
  const sentByStep = await sentCounts(db, 'step_id', stepIds);
  const sentByVariant = await sentCounts(db, 'variant_id', (variants ?? []).map((v) => v.id));
  return (seqs ?? []).map((s) => ({
    ...s,
    campaign_count: campaignsBySeq.get(s.id)?.size ?? 0,
    steps: (steps ?? [])
      .filter((st) => st.sequence_id === s.id)
      .map((st) => ({
        ...st,
        sent_count: sentByStep.get(st.id) ?? 0,
        variants: (variants ?? [])
          .filter((v) => v.step_id === st.id)
          .map((v) => ({ ...v, sent_count: sentByVariant.get(v.id) ?? 0 })),
      })),
  }));
}

/** A campaign with arms and live counts. */
export interface CampaignSummary extends Campaign {
  arms: { sequence_id: string; weight: number }[];
  enrolled: number;
  active: number;
}

/** All campaigns with arms and enrolment counts. */
export async function loadCampaigns(db: AdminDb): Promise<CampaignSummary[]> {
  const { data: campaigns, error } = await db.from('outreach_campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`campaigns: ${error.message}`);
  const out: CampaignSummary[] = [];
  for (const c of campaigns ?? []) {
    const [{ data: arms }, { count: enrolled }, { count: active }] = await Promise.all([
      db.from('outreach_campaign_arms').select('sequence_id, weight').eq('campaign_id', c.id),
      db.from('outreach_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
      db.from('outreach_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('status', 'active'),
    ]);
    out.push({ ...c, arms: arms ?? [], enrolled: enrolled ?? 0, active: active ?? 0 });
  }
  return out;
}

/** How many prospects a campaign audience would reach right now. */
export async function countAudience(db: AdminDb, audience: { states?: string[] | undefined; minScore?: number | undefined }): Promise<number> {
  let q = db.from('outreach_prospects').select('id', { count: 'exact', head: true })
    .eq('verdict', 'active').eq('stage', 'new').eq('do_not_contact', false);
  if (audience.states?.length) q = q.in('state', audience.states);
  if (audience.minScore !== undefined) q = q.gte('activity_score', audience.minScore);
  const { count: c, error } = await q;
  if (error) throw new Error(`audience: ${error.message}`);
  return c ?? 0;
}

// ───── Pipeline ───────────────────────────────────────────────────────

/** Prospects past "new", grouped for the board. */
export async function loadPipeline(db: AdminDb): Promise<ProspectRow[]> {
  const { data, error } = await db.from('outreach_prospects').select(ROW_COLUMNS)
    .in('stage', ['contacted', 'replied', 'demo_booked', 'demo_done', 'signed_up', 'paying', 'lost'])
    .order('updated_at', { ascending: false }).limit(500);
  if (error) throw new Error(`pipeline: ${error.message}`);
  return data ?? [];
}

// ───── Analytics ──────────────────────────────────────────────────────

/** Analytics plus deliverability. */
export interface AnalyticsData {
  report: AnalyticsReport;
  funnel: Funnel;
  daily: { day: string; email: number; instagram: number }[];
  bounceRate: number | null;
  optOutRate: number | null;
}

async function pagedSelect<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Load analytics, optionally for one campaign. */
export async function loadAnalytics(db: AdminDb, campaignId: string | null): Promise<AnalyticsData> {
  const enrollments = await pagedSelect((a, b) => {
    let q = db.from('outreach_enrollments').select('id, prospect_id, sequence_id, enrolled_at, campaign_id').order('id');
    if (campaignId) q = q.eq('campaign_id', campaignId);
    return q.range(a, b);
  });
  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  const prospectIds = [...new Set(enrollments.map((e) => e.prospect_id))];

  const prospects = new Map<string, Prospect>();
  for (let i = 0; i < prospectIds.length; i += 200) {
    const { data } = await db.from('outreach_prospects').select('*').in('id', prospectIds.slice(i, i + 200));
    for (const p of data ?? []) prospects.set(p.id, p);
  }

  const messages = (await pagedSelect((a, b) =>
    db.from('outreach_messages').select('id, enrollment_id, step_id, variant_id, channel, sent_at, send_local_hour, send_local_weekday')
      .eq('status', 'sent').order('id').range(a, b),
  )).filter((m) => enrollmentIds.has(m.enrollment_id));

  const stepIds = [...new Set(messages.map((m) => m.step_id))];
  const variantIds = [...new Set(messages.map((m) => m.variant_id).filter((v): v is string => !!v))];
  const { data: steps } = stepIds.length ? await db.from('outreach_sequence_steps').select('id, position').in('id', stepIds) : { data: [] as { id: string; position: number }[] };
  const { data: variants } = variantIds.length ? await db.from('outreach_variants').select('id, label').in('id', variantIds) : { data: [] as { id: string; label: string }[] };
  const stepPos = new Map((steps ?? []).map((s) => [s.id, s.position]));
  const variantLabel = new Map((variants ?? []).map((v) => [v.id, v.label]));

  const events = await pagedSelect((a, b) =>
    db.from('outreach_events').select('prospect_id, type, occurred_at')
      .in('type', ['replied', 'demo_booked', 'paying', 'opted_out', 'email_bounced']).or(CONFIRMED_ONLY).order('id').range(a, b),
  );
  const prospectSet = new Set(prospectIds);
  const { data: seqs } = await db.from('outreach_sequences').select('id, name');

  const enrollmentFacts: EnrollmentFact[] = enrollments.map((e) => {
    const p = prospects.get(e.prospect_id);
    return {
      id: e.id, prospectId: e.prospect_id, sequenceId: e.sequence_id, enrolledAt: e.enrolled_at,
      state: p?.state ?? null, score: p?.activity_score ?? null, hasWebsite: !!p?.website, hasInstagram: !!p?.instagram_handle,
      followers: p?.ig_followers ?? null, emailSource: p?.email_source ?? null, sentiment: p?.reply_sentiment ?? null,
    };
  });
  const messageFacts: MessageFact[] = messages.map((m) => ({
    id: m.id, enrollmentId: m.enrollment_id, stepPosition: stepPos.get(m.step_id) ?? 0, variantId: m.variant_id,
    variantLabel: m.variant_id ? variantLabel.get(m.variant_id) ?? null : null, channel: m.channel, sentAt: m.sent_at!,
    localHour: m.send_local_hour, localWeekday: m.send_local_weekday,
  }));
  const outcomeFacts: OutcomeFact[] = events
    .filter((e) => e.prospect_id && prospectSet.has(e.prospect_id))
    .map((e) => ({ prospectId: e.prospect_id!, type: e.type as OutcomeFact['type'], at: e.occurred_at }));

  const report = computeAnalytics(enrollmentFacts, messageFacts, outcomeFacts, { sequences: new Map((seqs ?? []).map((s) => [s.id, s.name])) });

  // Deliverability: last 14 days of sends.
  const since = new Date(Date.now() - 14 * 86_400_000);
  const dayMap = new Map<string, { email: number; instagram: number }>();
  for (let i = 13; i >= 0; i--) dayMap.set(localDateKey(new Date(Date.now() - i * 86_400_000), CAP_TIMEZONE), { email: 0, instagram: 0 });
  for (const m of messages) {
    if (Date.parse(m.sent_at!) < since.getTime()) continue;
    const d = dayMap.get(localDateKey(new Date(m.sent_at!), CAP_TIMEZONE));
    if (d) d[m.channel as 'email' | 'instagram']++;
  }
  const emailsSent = messages.filter((m) => m.channel === 'email').length;
  const bounces = outcomeFacts.filter((e) => e.type === 'email_bounced').length;
  const optOuts = outcomeFacts.filter((e) => e.type === 'opted_out').length;

  return {
    report,
    funnel: await loadFunnel(db),
    daily: [...dayMap].map(([day, v]) => ({ day, ...v })),
    bounceRate: emailsSent ? bounces / emailsSent : null,
    optOutRate: messages.length ? optOuts / new Set(messages.map((m) => m.enrollment_id)).size : null,
  };
}

// ───── Settings ───────────────────────────────────────────────────────

/** The Settings view. */
export interface SettingsData {
  settings: OutreachSettings;
  mailbox: MailboxInfo | null;
  /** The admin's active meeting types, each with its public booking URL. */
  meetingTypes: { id: string; name: string; bookingUrl: string }[];
  bookingBase: string | null;
  oauthConfigured: boolean;
  apifyConfigured: boolean;
}

/** Load the Settings view. Meeting types are the signed-in admin's own. */
export async function loadSettingsView(db: AdminDb, adminUserId: string): Promise<SettingsData> {
  const settings = await loadSettings(db);
  const { data: types } = await db.from('meeting_types').select('id, name, share_token').eq('user_id', adminUserId).eq('active', true).order('name');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    settings,
    mailbox: await loadMailboxInfo(db),
    meetingTypes: (types ?? []).map((t) => ({ id: t.id, name: t.name, bookingUrl: `${appUrl}/book/${t.share_token}` })),
    bookingBase: await bookingBaseUrl(db, settings),
    oauthConfigured: !!process.env.OUTREACH_GOOGLE_CLIENT_ID && !!process.env.OUTREACH_GOOGLE_CLIENT_SECRET,
    apifyConfigured: !!process.env.APIFY_TOKEN,
  };
}
