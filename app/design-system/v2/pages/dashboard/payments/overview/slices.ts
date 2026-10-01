import { monthsBetween } from '../dates';
import type { Invoice } from '../payments-data';
import { dateOf, type Range } from '../reports-data';
import { SERVICES } from '../services';

/**
 * The cash flow chart's scopes: which part of the business it shows,
 * picked on the Service filter chip on the card: all work, or any mix of
 * services (types of job: MC, MC + Celebrant, Celebrant, Corporate). A scope
 * filters; it never recolours. Every bar keeps the same three parts in
 * the same colours (received solid, overdue red, to come striped).
 * (Rejected 2026-09-30: stacking each category in its own colour,
 * slicing by payment in the plan, a dropdown menu of services with
 * totals, and a breakdown bar with a key of amounts: too much text.)
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/slices
 */

/** One scope: its name and which invoices it keeps. */
export interface Slice {
  id: string;
  label: string;
  of: (i: Invoice) => boolean;
}

/** Each service as a scope, in catalogue order: the Service filter's options. */
export const SERVICE_SCOPES: Slice[] = SERVICES.map((service) => {
  const items = new Set(service.packages.map((p) => p.item));
  return { id: service.id, label: service.name, of: (i: Invoice) => items.has(i.item) };
});

/** The scope for the services ticked in the filter: all work when none are. */
export function scopeOf(ids: string[]): Slice {
  const picked = SERVICE_SCOPES.filter((s) => ids.includes(s.id));
  if (picked.length === 0) return { id: 'all', label: 'All work', of: () => true };
  return { id: ids.join('+'), label: picked.map((s) => s.label).join(', '), of: (i) => picked.some((s) => s.of(i)) };
}

/** Diagonal stripes over a fill: money still to come. */
const STRIPES =
  'bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_oklab,var(--color-field)_45%,transparent)_4px_6px)]';

/** Received, overdue and to come: the fills, shared with the stat strip and the key. */
export const SWATCH = {
  received: 'bg-grass-700',
  overdue: 'bg-danger/70',
  toCome: `bg-grass-400 ${STRIPES}`,
} as const;

/** A bar's parts, bottom first: fill, tooltip words, and which invoices count. */
export const SERIES = [
  { id: 'received', label: 'received', fill: SWATCH.received, of: (i: Invoice) => i.group === 'paid' },
  { id: 'overdue', label: 'overdue', fill: SWATCH.overdue, of: (i: Invoice) => i.group === 'overdue' },
  { id: 'toCome', label: 'to come', fill: SWATCH.toCome, of: (i: Invoice) => i.group === 'soon' || i.group === 'later' },
] as const;

/** One month of the chart: its total and each part's sum, bottom first. */
export interface SlicedMonth {
  key: string;
  total: number;
  parts: { series: (typeof SERIES)[number]; amount: number }[];
}

/**
 * Each month of the range, for the invoices in `slice`. Cash basis, as the
 * stat strip: an invoice counts in the month it was paid, or, unpaid, the
 * month it falls due.
 */
export function slicedMonths(all: Invoice[], r: Range, slice: Slice): SlicedMonth[] {
  const kept = all.filter((i) => slice.of(i) && dateOf(i) >= r.from && dateOf(i) <= r.to);
  return monthsBetween(r.from.slice(0, 7), r.to.slice(0, 7)).map((key) => {
    const rows = kept.filter((i) => dateOf(i).startsWith(key));
    const parts = SERIES.map((series) => ({
      series,
      amount: rows.filter(series.of).reduce((s, i) => s + i.amount, 0),
    }));
    return { key, total: parts.reduce((s, p) => s + p.amount, 0), parts };
  });
}
