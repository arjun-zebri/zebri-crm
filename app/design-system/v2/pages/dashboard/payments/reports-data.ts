import { formatDate } from '@/components/ui-v2/date-field';

import { TODAY, addDays, monthsBetween } from './dates';
import { gstOf, type Invoice } from './payments-data';

/**
 * The sums behind the Overview tab, over any run of months. Everything
 * is worked out from the same invoices the Invoices tab lists, so the
 * two always agree. Cash basis: an invoice counts in the month it was
 * paid, or, while unpaid, the month it falls due. That is how a sole
 * trader's BAS is usually done.
 *
 * @module app/design-system/v2/pages/dashboard/payments/reports-data
 */

/** A run of days, "YYYY-MM-DD" to "YYYY-MM-DD", inclusive. */
export interface Range {
  from: string;
  to: string;
}

/** The first month the demo has data for. */
const DATA_FROM = '2025-07';

/** The ready-made periods, most used first. The first is the default. */
export const PRESETS: (Range & { label: string })[] = [
  { label: 'FY 2026–27', from: '2026-07-01', to: '2027-06-30' },
  { label: 'FY 2025–26', from: '2025-07-01', to: '2026-06-30' },
  { label: 'This quarter', from: '2026-07-01', to: '2026-09-30' },
  { label: 'Last quarter', from: '2026-04-01', to: '2026-06-30' },
];

/** What the period control shows: a preset's name, or the dates picked. */
export const rangeLabel = (r: Range) =>
  PRESETS.find((p) => p.from === r.from && p.to === r.to)?.label ??
  (r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} to ${formatDate(r.to)}`);

/** The date an invoice counts on: paid, else due. */
const dateOf = (i: Invoice) => i.paidOn ?? i.dueOn;
const within = (i: Invoice, r: Range) => dateOf(i) >= r.from && dateOf(i) <= r.to;
const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0);

/** Invoices received in the range, newest first. */
export const receivedIn = (all: Invoice[], r: Range) =>
  all.filter((i) => i.paidOn && within(i, r)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

/** Each month of the range: received, overdue (by the month it fell due) and still to come. */
export function byMonth(all: Invoice[], r: Range) {
  return monthsBetween(r.from.slice(0, 7), r.to.slice(0, 7)).map((key) => {
    // Only the days inside the range count, so a range can start mid-month.
    const rows = all.filter((i) => dateOf(i).startsWith(key) && within(i, r));
    return {
      key,
      received: sum(rows.filter((i) => i.group === 'paid')),
      overdue: sum(rows.filter((i) => i.group === 'overdue')),
      toCome: sum(rows.filter((i) => i.group === 'soon' || i.group === 'later')),
    };
  });
}

/** Received this range to date against the same stretch a year earlier; `null` without last year's data. */
function growth(all: Invoice[], r: Range) {
  const back = (m: string) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;
  if (back(r.from).slice(0, 7) < DATA_FROM || r.from > TODAY) return null;
  const now = sum(all.filter((i) => i.paidOn && within(i, r) && i.paidOn <= TODAY));
  const cutoff = back(TODAY);
  const then = sum(all.filter((i) => i.paidOn && within(i, { from: back(r.from), to: back(r.to) }) && i.paidOn <= cutoff));
  return then ? Math.round(((now - then) / then) * 100) : null;
}

/** The BAS quarter a month falls in, and when that BAS is due. */
function basQuarter(month: string) {
  const y = Number(month.slice(0, 4));
  const q = Math.floor(((Number(month.slice(5)) + 5) % 12) / 3) + 1;
  const due = ['28 Oct', '28 Feb', '28 Apr', '28 Jul'][q - 1]!;
  return { q, due, fyStart: q === 1 || q === 2 ? y : y - 1 };
}

/** The four figures across the top of the Overview. */
export function summary(all: Invoice[], r: Range) {
  const inRange = all.filter((i) => within(i, r));
  const received = inRange.filter((i) => i.group === 'paid');
  const overdue = inRange.filter((i) => i.group === 'overdue');
  const toCome = inRange.filter((i) => i.group === 'soon' || i.group === 'later');
  const soon = all.filter((i) => !i.paidOn && i.dueOn >= TODAY && i.dueOn <= addDays(TODAY, 30));
  const current = TODAY.slice(0, 7);
  const bas = basQuarter(current);
  return {
    received: sum(received),
    receivedCount: received.length,
    growth: growth(all, r),
    toCome: sum(toCome),
    toComeCount: toCome.length,
    /** Due in the next 30 days; only worth saying when the range reaches past today. */
    next30: r.to >= TODAY ? sum(soon) : null,
    overdue: sum(overdue),
    overdueCount: overdue.length,
    oldest: Math.max(0, ...overdue.map((i) => i.late)),
    gst: received.reduce((s, i) => s + gstOf(i.amount), 0),
    /** The open BAS, when the range covers this month. */
    bas: TODAY >= r.from && TODAY <= r.to ? `Q${bas.q} BAS due ${bas.due}` : null,
  };
}

/** Unpaid invoices due in the next 30 days, soonest first. */
export const nextThirtyDays = (all: Invoice[]) =>
  all
    .filter((i) => !i.paidOn && i.dueOn >= TODAY && i.dueOn <= addDays(TODAY, 30))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

/**
 * The invoices on the What's next rail as of today: every overdue one,
 * oldest first, then what falls due in the next 30 days.
 */
export const whatsNext = (all: Invoice[]) => [
  ...all.filter((i) => i.group === 'overdue').sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
  ...nextThirtyDays(all),
];

/** The date an invoice counts on: paid, else due. */
export { dateOf };

/** GST by BAS quarter over the range, for the export. */
export function gstByQuarter(all: Invoice[], r: Range) {
  const out = new Map<string, { quarter: string; sales: number; gst: number; due: string }>();
  for (const i of receivedIn(all, r).reverse()) {
    const { q, due, fyStart } = basQuarter(i.paidOn!.slice(0, 7));
    const key = `FY ${fyStart}–${String(fyStart + 1).slice(2)} Q${q}`;
    const row = out.get(key) ?? { quarter: key, sales: 0, gst: 0, due };
    row.sales += i.amount;
    row.gst += gstOf(i.amount);
    out.set(key, row);
  }
  return [...out.values()];
}
