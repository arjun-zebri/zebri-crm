import { TODAY, daysBetween, monthDay } from '../payments/dates';
import type { InsightCard } from '../payments/overview/insights/tone';
import { coupleName, money } from '../payments/payments-data';
import type { Range } from '../payments/reports-data';

import { canNudge, dropOff, sentIn, stopOf, type Stop } from './insights';
import type { Proposal } from './proposals-data';
import { DEPOSIT, PACKAGES, templateOf, type PackageId, type TemplateId } from './templates-data';

/**
 * Zebri AI's insights on the Proposals Overview, behind the AI insights
 * button on the sent-to-booked chart, in the same split dialog as
 * Payments: up to three, each a headline, why (with the numbers), who or
 * what is behind it, and one move with the button that makes it. In
 * order: where most couples drop off (the same step the waterfall picks
 * out in amber), which template wins more often, and who has waited
 * longer than couples who book usually take. Each is left out when the
 * period has too few proposals to back it. Demo stand-in for what the
 * model would write.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/advice
 */

/** What an insight's button does: open a template in the builder, or send nudges. */
export type AdviceAction = { kind: 'template'; template: TemplateId } | { kind: 'nudge'; ids: string[] };

/** One insight: the dialog's card, plus what its button does. */
export interface Advice extends InsightCard {
  id: 'dropOff' | 'templates' | 'speed';
  action: AdviceAction;
}

// Below this many behind a figure it is noise, not a pattern.
const ENOUGH = 3;
// A template gap smaller than this many points is not worth acting on.
const GAP = 10;

// The rows under "Behind it" stop here, so a long period stays readable.
const ROWS = 6;

const tryOn = (template: TemplateId) => ({
  label: `Edit ${templateOf(template).name}`,
  doneLabel: 'Opened',
  action: { kind: 'template', template } as const,
});

/** The couples behind a drop-off, each with what they did. */
const rowsOf = (xs: Proposal[], detail: (p: Proposal) => string) =>
  xs.slice(0, ROWS).map((p) => ({ name: coupleName(p.names), detail: detail(p) }));

/** The middle value, rounded to whole days. */
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
}

/** The value that turns up most, first seen wins a tie; `undefined` for none. */
function mostCommon<T>(xs: T[]): T | undefined {
  const counts = new Map<T, number>();
  xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  let best: T | undefined;
  counts.forEach((n, x) => {
    if (best === undefined || n > (counts.get(best) ?? 0)) best = x;
  });
  return best;
}

const PAST: Record<Stop, number> = {
  unopened: 0,
  beforePackages: 1,
  sawPackages: 2,
  noDeposit: 3,
  booked: 4,
};
/** How many got at least as far as `stop`. */
const reached = (sent: Proposal[], stop: Stop) =>
  sent.filter((p) => PAST[stopOf(p)] >= PAST[stop]).length;

/**
 * The packages fix: lead with the next package down from the one they
 * weighed, and show theirs as the upgrade; with nothing cheaper on
 * offer, add one, so there is an easier yes.
 */
function packagesFix(template: TemplateId, leaning: PackageId) {
  const lean = PACKAGES[leaning];
  const cheaper = templateOf(template)
    .packages.filter((id) => PACKAGES[id].price < lean.price)
    .sort((a, b) => PACKAGES[b].price - PACKAGES[a].price)[0];
  return cheaper
    ? `Try leading with ${PACKAGES[cheaper].name} and showing ${lean.name} as an upgrade.`
    : `Try adding a smaller package under ${lean.name}, so there’s an easier yes.`;
}

// Amber, as the waterfall paints the step most couples stop at.
const DROP_CARD = { tone: 'warning', tag: 'Drop-off' } as const;

/** Where most couples stop, or `null` when no step loses enough of them to say anything. */
function dropOffAdvice(all: Proposal[], r: Range): Advice | null {
  const worst = dropOff(all, r).worst;
  if (!worst || worst.count < ENOUGH) return null;
  const sent = sentIn(all, r);
  const stalled = sent.filter((p) => stopOf(p) === worst.stop);
  const template = mostCommon(stalled.map((p) => p.template)) ?? 'full-day';
  const n = worst.count;
  switch (worst.stop) {
    case 'sawPackages': {
      const leaning =
        mostCommon(
          stalled
            .filter((p) => p.template === template)
            .flatMap((p) => (p.leaning ? [p.leaning] : [])),
        ) ??
        templateOf(template).packages[0] ??
        'classic';
      const lean = PACKAGES[leaning];
      const of = reached(sent, 'sawPackages');
      return {
        id: 'dropOff',
        ...DROP_CARD,
        metric: `${n} of ${of}`,
        title: 'Couples stall at your packages',
        why: `${n} of ${of} who saw them didn’t accept. Most were weighing ${lean.name} at ${money(lean.price)}.`,
        rows: rowsOf(stalled, (p) => `Weighing ${p.leaning ? PACKAGES[p.leaning].name : 'no one package'} · ${templateOf(p.template).name}`),
        move: packagesFix(template, leaning),
        ...tryOn(template),
      };
    }
    case 'unopened':
      return {
        id: 'dropOff',
        ...DROP_CARD,
        metric: `${n} of ${sent.length}`,
        title: 'Most proposals never get opened',
        why: `${n} of ${sent.length} sent were never opened, most of them ${templateOf(template).name}.`,
        rows: rowsOf(stalled, (p) => `Sent ${monthDay(p.sentOn!)} · ${templateOf(p.template).name}`),
        move: 'Try opening the email with their names and wedding date, and keep it to two lines.',
        ...tryOn(template),
      };
    case 'beforePackages':
      return {
        id: 'dropOff',
        ...DROP_CARD,
        metric: `${n} of ${reached(sent, 'beforePackages')}`,
        title: 'Couples leave before your packages',
        why: `${n} of ${reached(sent, 'beforePackages')} who opened it left before they got that far.`,
        rows: rowsOf(stalled, (p) => `${p.when} · ${templateOf(p.template).name}`),
        move: 'Try moving the packages up, straight after the welcome.',
        ...tryOn(template),
      };
    case 'noDeposit':
      return {
        id: 'dropOff',
        ...DROP_CARD,
        metric: `${n} of ${reached(sent, 'noDeposit')}`,
        title: 'Couples accept but don’t pay',
        why: `${n} of ${reached(sent, 'noDeposit')} who accepted never paid the ${DEPOSIT}% deposit.`,
        rows: rowsOf(stalled, (p) => `Accepted ${monthDay(p.acceptedOn!)} · no deposit`),
        move: 'Try taking the deposit in the same step as accepting.',
        ...tryOn(template),
      };
  }
}

/**
 * The template that wins most against the one that wins least, over the
 * proposals sent in the period with an answer; `null` unless both have
 * enough answers and the gap is worth acting on.
 */
function templatesAdvice(all: Proposal[], r: Range): Advice | null {
  const answered = sentIn(all, r).filter((p) => p.group === 'accepted' || p.group === 'closed');
  const rates = [...new Set(answered.map((p) => p.template))]
    .map((id) => {
      const mine = answered.filter((p) => p.template === id);
      return {
        id,
        n: mine.length,
        rate: Math.round((mine.filter((p) => p.group === 'accepted').length / mine.length) * 100),
      };
    })
    .filter((t) => t.n >= ENOUGH)
    .sort((a, b) => b.rate - a.rate);
  const best = rates[0];
  const worst = rates[rates.length - 1];
  if (!best || !worst || best.rate - worst.rate < GAP) return null;
  const [b, w] = [templateOf(best.id).name, templateOf(worst.id).name];
  return {
    id: 'templates',
    tone: 'brand',
    tag: 'Templates',
    metric: `${best.rate}% vs ${worst.rate}%`,
    title: `${b} wins more often`,
    why: `${best.rate}% of ${b} proposals were accepted, against ${worst.rate}% for ${w}.`,
    rows: rates.map((t) => ({ name: templateOf(t.id).name, detail: `${t.rate}% accepted · ${t.n} answered` })),
    move: `Try sending ${w} in ${b}’s layout, and see if it closes the gap.`,
    ...tryOn(worst.id),
  };
}

/**
 * How fast couples who book say yes, against the proposals still out
 * that have waited well past that (twice as long, and at least three
 * days more); `null` with too few bookings or nobody waiting that long.
 */
function speedAdvice(all: Proposal[], r: Range): Advice | null {
  const days = sentIn(all, r).flatMap((p) =>
    p.acceptedOn && p.sentOn ? [daysBetween(p.sentOn, p.acceptedOn)] : [],
  );
  if (days.length < ENOUGH) return null;
  const typical = Math.max(1, median(days));
  const cut = Math.max(typical * 2, typical + 3);
  // Anyone followed up in the last few days is left alone, as Nudge all does.
  const late = all
    .filter((p) => canNudge(p, new Set()) && p.sentOn && daysBetween(p.sentOn, TODAY) > cut)
    .sort((a, b) => a.sentOn!.localeCompare(b.sentOn!));
  if (late.length === 0) return null;
  return {
    id: 'speed',
    tone: 'warning',
    tag: 'Going cold',
    metric: `${late.length} waiting`,
    title: 'Couples who book, book fast',
    why: `Most said yes within ${typical === 1 ? 'a day' : `${typical} days`}. ${late.length} still out ${late.length === 1 ? 'has' : 'have'} waited over ${cut} days.`,
    rows: rowsOf(late, (p) => `Sent ${daysBetween(p.sentOn!, TODAY)} days ago · ${p.group === 'opened' ? 'opened' : 'not opened'}`),
    move: 'Send each of them a nudge today that asks one easy question, before they go cold. Zebri drafts each one from what they read.',
    label: late.length === 1 ? `Nudge ${coupleName(late[0]!.names)}` : `Nudge all ${late.length}`,
    doneLabel: 'Nudged',
    action: { kind: 'nudge', ids: late.map((p) => p.id) },
  };
}

/** Zebri's insights for the period, most useful first; empty when there is not enough to go on. */
export function insightsFor(all: Proposal[], r: Range): Advice[] {
  return [dropOffAdvice(all, r), templatesAdvice(all, r), speedAdvice(all, r)].filter(
    (a): a is Advice => a !== null,
  );
}
