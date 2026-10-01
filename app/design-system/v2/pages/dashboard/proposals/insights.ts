import { TODAY, addDays, daysBetween } from '../payments/dates';
import type { Range } from '../payments/reports-data';

import type { Proposal } from './proposals-data';
import type { TemplateId } from './templates-data';

/**
 * The sums behind the Proposals Overview, worked out from the same list
 * the Proposals tab shows so the tabs always agree. A proposal counts in
 * the period it was sent; Won value counts on the day it was accepted.
 * Out now and the What's next rail (opened not accepted, expiring soon) are always as of today,
 * since they are about what to do next.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/insights
 */

/** Days a couple is left alone after a nudge before Nudge all includes them again. */
export const NUDGE_GAP = 3;
/** How far ahead Expiring soon looks. */
export const EXPIRING_DAYS = 14;

const within = (iso: string | undefined, r: Range) =>
  Boolean(iso) && iso! >= r.from && iso! <= r.to;
/** The proposals sent in the period, the ones the waterfall and advice count. */
export const sentIn = (all: Proposal[], r: Range) => all.filter((p) => within(p.sentOn, r));
const sum = (xs: Proposal[]) => xs.reduce((s, p) => s + p.value, 0);
const isOut = (p: Proposal) => p.group === 'opened' || p.group === 'unopened';

/** The middle value, rounded to whole days; `null` for none. */
function median(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2);
}

/** The four figures across the top of the Overview. */
export function summary(all: Proposal[], r: Range) {
  const sent = all.filter((p) => within(p.sentOn, r));
  const answered = sent.filter((p) => p.group === 'accepted' || p.group === 'closed');
  const accepted = sent.filter((p) => p.group === 'accepted');
  const won = all.filter((p) => within(p.acceptedOn, r));
  const out = all.filter(isOut);
  return {
    /** Of the proposals sent in the period that have an answer, the share accepted; `null` before any answer. */
    rate: answered.length ? Math.round((accepted.length / answered.length) * 100) : null,
    accepted: accepted.length,
    answered: answered.length,
    won: sum(won),
    wonCount: won.length,
    out: sum(out),
    outCount: out.length,
    outOpened: out.filter((p) => p.group === 'opened').length,
    daysToAccept: median(won.map((p) => daysBetween(p.sentOn!, p.acceptedOn!))),
  };
}

/** Where a proposal stopped: the step after its last one, or `booked` once the deposit is paid. */
export type Stop = 'unopened' | 'beforePackages' | 'sawPackages' | 'noDeposit' | 'booked';

/**
 * The furthest a proposal got, read from its latest step back, so a later
 * step always counts the earlier ones too (a proposal marked accepted by
 * phone counts as opened and read, whatever the tracking saw).
 */
export function stopOf(p: Proposal): Stop {
  if (p.paidOn) return 'booked';
  if (p.acceptedOn) return 'noDeposit';
  if (p.reached) return 'sawPackages';
  if (p.openedOn) return 'beforePackages';
  return 'unopened';
}

/** The drop-off steps in order, as the waterfall names them. */
export const DROPS: { stop: Exclude<Stop, 'booked'>; label: string; short: string }[] = [
  { stop: 'unopened', label: 'Didn’t open', short: 'Not opened' },
  { stop: 'beforePackages', label: 'Left before packages', short: 'Left early' },
  { stop: 'sawPackages', label: 'Saw packages, didn’t accept', short: 'Didn’t accept' },
  { stop: 'noDeposit', label: 'Accepted, no deposit', short: 'No deposit' },
];

/** Whether a proposal can be nudged now: still out, and not followed up in the last few days. */
export const canNudge = (p: Proposal, nudgedHere: ReadonlySet<string>) =>
  (p.group === 'opened' || p.group === 'unopened') &&
  !nudgedHere.has(p.id) &&
  (!p.nudgedOn || daysBetween(p.nudgedOn, TODAY) >= NUDGE_GAP);

/**
 * The waterfall for proposals sent in the period: how many were sent,
 * how many stopped at each step, and the step most couples stopped at
 * (the biggest count, since that is where most of the lost bookings
 * went).
 */
export function dropOff(all: Proposal[], r: Range) {
  const sent = sentIn(all, r);
  const at = (stop: Stop) => sent.filter((p) => stopOf(p) === stop);
  const drops = DROPS.map((d) => ({ ...d, rows: at(d.stop) }));
  const worst = drops.reduce<(typeof drops)[number] | null>(
    (w, d) => (d.rows.length && (!w || d.rows.length > w.rows.length) ? d : w),
    null,
  );
  return {
    sent: sent.length,
    booked: at('booked').length,
    drops: drops.map((d) => ({
      stop: d.stop,
      label: d.label,
      short: d.short,
      value: d.rows.length,
    })),
    worst: worst
      ? {
          stop: worst.stop,
          count: worst.rows.length,
          index: DROPS.findIndex((d) => d.stop === worst.stop),
        }
      : null,
  };
}

/** What the biggest drop means, as the line under the title says it. */
export const DROP_WORDS: Record<Exclude<Stop, 'booked'>, string> = {
  unopened: 'Most couples who drop off never open it.',
  beforePackages: 'Most couples who drop off leave before your packages.',
  sawPackages: 'Most couples who drop off see your packages and stop there.',
  noDeposit: 'Most couples who drop off accept and never pay the deposit.',
};

/** Opened and not accepted, the ones reading most recently and most often first. */
export const openedNotAccepted = (all: Proposal[]) =>
  all
    .filter((p) => p.group === 'opened')
    .sort(
      (a, b) =>
        (b.lastOpenedOn ?? '').localeCompare(a.lastOpenedOn ?? '') ||
        (b.opens ?? 0) - (a.opens ?? 0),
    );

/** Out and expiring within the window, soonest first. */
export const expiringSoon = (all: Proposal[]) =>
  all
    .filter(
      (p) =>
        isOut(p) &&
        p.expiresOn &&
        p.expiresOn >= TODAY &&
        p.expiresOn <= addDays(TODAY, EXPIRING_DAYS),
    )
    .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));

/** How each template has done, over every proposal made from it. */
export function templateStats(all: Proposal[], id: TemplateId) {
  const mine = all.filter((p) => p.template === id && p.sentOn);
  const answered = mine.filter((p) => p.group === 'accepted' || p.group === 'closed');
  const accepted = answered.filter((p) => p.group === 'accepted').length;
  return {
    sent: mine.length,
    rate: answered.length ? Math.round((accepted / answered.length) * 100) : null,
  };
}
