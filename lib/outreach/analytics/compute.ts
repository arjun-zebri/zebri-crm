/**
 * Turn raw enrolments, messages and events into the comparisons on the
 * Analytics view: by arm, variant, step, send hour/weekday and segment.
 *
 * Two units of analysis, chosen per question:
 * - per **enrolment** for arm and segment ("did this person reply /
 *   book / pay?"), because those describe the whole sequence;
 * - per **message** for variant, step and timing. A reply is credited to
 *   the last message sent before it (the one the person answered). A
 *   booking or a payment is credited the same way, whether or not they
 *   replied: a link-click booking still belongs to the message that led to it.
 *
 * Pure.
 *
 * @module lib/outreach/analytics/compute
 */
import { wilson, type RateWithInterval } from './wilson';

/** An enrolment with the prospect facts used for segments. */
export interface EnrollmentFact {
  id: string;
  prospectId: string;
  sequenceId: string;
  enrolledAt: string;
  state: string | null;
  score: number | null;
  hasWebsite: boolean;
  hasInstagram: boolean;
  followers: number | null;
  emailSource: string | null;
  sentiment: string | null;
}

/** A sent message. */
export interface MessageFact {
  id: string;
  enrollmentId: string;
  stepPosition: number;
  variantId: string | null;
  variantLabel: string | null;
  channel: string;
  sentAt: string;
  localHour: number | null;
  localWeekday: number | null;
}

/** An outcome event for a prospect. */
export interface OutcomeFact {
  prospectId: string;
  type: 'replied' | 'demo_booked' | 'paying' | 'opted_out' | 'email_bounced';
  at: string;
}

/** Rates reported for every row. */
export interface RowMetrics {
  n: number;
  reply: RateWithInterval;
  positive: RateWithInterval;
  booked: RateWithInterval;
  paying: RateWithInterval;
  optOut: RateWithInterval;
}

/** One table row. */
export interface BreakdownRow {
  key: string;
  label: string;
  metrics: RowMetrics;
}

/** Everything the Analytics view renders. */
export interface AnalyticsReport {
  arms: BreakdownRow[];
  variants: BreakdownRow[];
  steps: BreakdownRow[];
  hours: BreakdownRow[];
  weekdays: BreakdownRow[];
  segments: { dimension: string; rows: BreakdownRow[] }[];
}

interface Outcome {
  contacted: boolean;
  replied: boolean;
  positive: boolean;
  booked: boolean;
  paying: boolean;
  optedOut: boolean;
}

const WEEKDAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A message that was sent and earned nothing yet. */
const NO_OUTCOME: Outcome = { contacted: true, replied: false, positive: false, booked: false, paying: false, optedOut: false };

function metrics(outcomes: Outcome[]): RowMetrics {
  const n = outcomes.length;
  const count = (f: (o: Outcome) => boolean) => outcomes.filter(f).length;
  return {
    n,
    reply: wilson(count((o) => o.replied), n),
    positive: wilson(count((o) => o.positive), n),
    booked: wilson(count((o) => o.booked), n),
    paying: wilson(count((o) => o.paying), n),
    optOut: wilson(count((o) => o.optedOut), n),
  };
}

function group<T>(items: T[], keyOf: (t: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Score band label. */
export function scoreBand(score: number | null): string {
  if (score === null) return 'Unscored';
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  return '0-39';
}

/** Follower band label. */
export function followerBand(followers: number | null): string {
  if (followers === null) return 'No IG data';
  if (followers >= 2000) return '2k+';
  if (followers >= 500) return '500-2k';
  return 'Under 500';
}

/** Build the report. `labels` names sequences for the arm table. */
export function computeAnalytics(
  enrollments: EnrollmentFact[],
  messages: MessageFact[],
  events: OutcomeFact[],
  labels: { sequences: Map<string, string> },
): AnalyticsReport {
  const eventsByProspect = group(events, (e) => e.prospectId);
  const messagesByEnrollment = group(messages, (m) => m.enrollmentId);
  for (const list of messagesByEnrollment.values()) list.sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  const outcomeOf = new Map<string, Outcome>();
  // Message id -> the outcome credited to that message (see the header).
  const creditedTo = new Map<string, Outcome>();
  const credit = (messageId: string, flags: Partial<Outcome>) => {
    const cur = creditedTo.get(messageId) ?? { ...NO_OUTCOME };
    creditedTo.set(messageId, {
      ...cur,
      replied: cur.replied || !!flags.replied,
      positive: cur.positive || !!flags.positive,
      booked: cur.booked || !!flags.booked,
      paying: cur.paying || !!flags.paying,
    });
  };

  for (const e of enrollments) {
    const evs = (eventsByProspect.get(e.prospectId) ?? []).filter((x) => x.at >= e.enrolledAt);
    const first = (type: OutcomeFact['type']) => evs.filter((x) => x.type === type).map((x) => x.at).sort()[0] ?? null;
    const replyAt = first('replied');
    const bookedAt = first('demo_booked');
    const payingAt = first('paying');
    const sent = messagesByEnrollment.get(e.id) ?? [];
    const o: Outcome = {
      contacted: sent.length > 0,
      replied: replyAt !== null,
      positive: replyAt !== null && e.sentiment === 'positive',
      booked: bookedAt !== null,
      paying: payingAt !== null,
      optedOut: first('opted_out') !== null,
    };
    outcomeOf.set(e.id, o);
    // The last message sent at or before the event is the one it followed.
    const lastBefore = (at: string | null) => (at ? [...sent].reverse().find((m) => m.sentAt <= at) : undefined);
    const answered = lastBefore(replyAt);
    if (answered) credit(answered.id, { replied: true, positive: o.positive });
    const bookedBy = lastBefore(bookedAt);
    if (bookedBy) credit(bookedBy.id, { booked: true });
    const paidBy = lastBefore(payingAt);
    if (paidBy) credit(paidBy.id, { paying: true });
  }

  const contacted = enrollments.filter((e) => outcomeOf.get(e.id)?.contacted);
  const row = (key: string, label: string, outcomes: Outcome[]): BreakdownRow => ({ key, label, metrics: metrics(outcomes) });
  const messageOutcome = (m: MessageFact) => creditedTo.get(m.id) ?? { ...NO_OUTCOME };
  const byKey = (a: BreakdownRow, b: BreakdownRow) => a.key.localeCompare(b.key, undefined, { numeric: true });

  const arms = [...group(contacted, (e) => e.sequenceId)].map(([id, list]) =>
    row(id, labels.sequences.get(id) ?? 'Deleted sequence', list.map((e) => outcomeOf.get(e.id)!)),
  );
  const variants = [...group(messages, (m) => (m.variantId ? `${m.stepPosition}:${m.variantId}` : null))].map(([key, list]) =>
    row(key, `Step ${list[0]!.stepPosition} · ${list[0]!.channel === 'email' ? 'Email' : 'IG'} · Variant ${list[0]!.variantLabel ?? '?'}`, list.map(messageOutcome)),
  ).sort(byKey);
  const steps = [...group(messages, (m) => String(m.stepPosition))].map(([key, list]) => row(key, `Step ${key}`, list.map(messageOutcome))).sort(byKey);
  const hours = [...group(messages, (m) => (m.localHour === null ? null : String(m.localHour)))].map(([key, list]) =>
    row(key, `${key.padStart(2, '0')}:00`, list.map(messageOutcome)),
  ).sort(byKey);
  const weekdays = [...group(messages, (m) => (m.localWeekday === null ? null : String(m.localWeekday)))].map(([key, list]) =>
    row(key, WEEKDAY_LABELS[Number(key)] ?? key, list.map(messageOutcome)),
  ).sort(byKey);

  const segment = (dimension: string, keyOf: (e: EnrollmentFact) => string) => ({
    dimension,
    rows: [...group(contacted, keyOf)].map(([key, list]) => row(key, key, list.map((e) => outcomeOf.get(e.id)!))).sort(byKey),
  });

  return {
    arms,
    variants,
    steps,
    hours,
    weekdays,
    segments: [
      segment('State', (e) => e.state ?? 'Unknown'),
      segment('Activity score', (e) => scoreBand(e.score)),
      segment('Website', (e) => (e.hasWebsite ? 'Has website' : 'No website')),
      segment('Instagram', (e) => (e.hasInstagram ? 'Has Instagram' : 'No Instagram')),
      segment('IG followers', (e) => followerBand(e.followers)),
      segment('Email source', (e) => (e.emailSource === 'found' ? 'Found on website' : e.emailSource === 'sheet' ? 'From sheet' : 'None')),
    ],
  };
}
