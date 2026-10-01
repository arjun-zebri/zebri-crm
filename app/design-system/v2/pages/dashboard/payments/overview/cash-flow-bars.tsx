import type { CSSProperties } from 'react';

import { TODAY, monthFull, monthLong, monthShort } from '../dates';
import { money } from '../payments-data';

import type { SlicedMonth } from './slices';

/**
 * The cash flow chart's plot: one bar per month, stacked by the slice
 * picked on the card (solid for money in, striped for money to come). A
 * dashed line labelled Today splits past from ahead; months ahead get
 * quieter labels, and a month with nothing in it draws nothing. No axis:
 * each bar carries its total above it, short ("$4.4k"), and hovering or
 * focusing a month shows the split just above its bar. A month a What's next row
 * points at stays lit while the rest fade back. Each month is focusable
 * and names its figures, so screen readers get the numbers too.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/cash-flow-bars
 */

export interface CashFlowBarsProps {
  months: SlicedMonth[];
  /** The month a rail row points at, "2026-10". */
  focus: string | null;
}

/** A round top for the scale, in steps a person would pick. */
function niceMax(n: number) {
  for (const step of [500, 1000, 2000, 2500, 5000]) if (n <= step * 4) return step * 4;
  return Math.ceil(n / 5000) * 5000;
}

/** A bar's total, short enough to sit over a narrow bar: "$4.4k", "$800". */
const short = (n: number) => (n < 1000 ? `$${n}` : `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`);

/** Tooltip placement: centred, but pinned inward at either end so it stays inside the card. */
const edge = (i: number, n: number) => (i === 0 ? 'left-0' : i >= n - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2');

/** The bars. See {@link CashFlowBarsProps}. */
export function CashFlowBars({ months, focus }: CashFlowBarsProps) {
  const now = TODAY.slice(0, 7);
  // Each slice gets its own scale: with no axis, what reads is one month against another.
  const top = niceMax(Math.max(...months.map((m) => m.total), 1));
  // Past two dozen months the labels would collide, so every other one shows.
  const sparse = months.length > 14;
  return (
    <>
      <ul className="relative flex h-[max(14rem,calc(100dvh-27.125rem))] items-end gap-3 pt-12 border-b border-zebra-950/15">
        {months.map((m, i) => {
          const parts = m.parts.filter((p) => p.amount > 0);
          const words = parts.map((p) => `${money(p.amount)} ${p.series.label}`);
          return (
            <li
              key={m.key}
              tabIndex={0}
              aria-label={`${monthFull(m.key)}: ${words.join(', ') || 'nothing'}`}
              className={`group relative flex h-full flex-1 items-end justify-center rounded-button transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
                focus && focus !== m.key ? 'opacity-35' : ''
              }`}
            >
              {m.key === now ? (
                <>
                  <span aria-hidden="true" className="absolute -right-1.5 -top-6 bottom-0 border-l border-dashed border-zebra-950/70" />
                  <span aria-hidden="true" className="absolute -right-1.5 -top-12 translate-x-1/2 whitespace-nowrap type-body text-zebra-500">
                    Today
                  </span>
                </>
              ) : null}
              {/* The bar (or the empty slot) is the tooltip's anchor, so the
                  tooltip sits just above it, not at the top of the plot. */}
              <span
                aria-hidden="true"
                style={{ '--h': `${(m.total / top) * 100}%` } as CSSProperties}
                className={`relative flex w-full flex-col-reverse gap-0.5 ${
                  m.total === 0 ? 'h-0' : 'h-[var(--h)]'
                }`}
              >
                {parts.map((p, j) => (
                  <span
                    key={p.series.id}
                    style={{ '--f': p.amount } as CSSProperties}
                    className={`flex-[var(--f)] transition-[flex-grow] duration-300 motion-reduce:transition-none ${p.series.fill} ${
                      j === parts.length - 1 ? 'rounded-t-check' : ''
                    }`}
                  />
                ))}
                {m.total > 0 ? (
                  <span className="absolute inset-x-0 bottom-full mb-1 text-center max-sm:hidden type-body tabular-nums text-zebra-500 group-hover:invisible group-focus-visible:invisible">
                    {short(m.total)}
                  </span>
                ) : null}
                <span className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap ${edge(i, months.length)} rounded-button bg-zebra-950 px-2.5 py-1.5 type-body text-zebra-50 shadow-lg group-hover:block group-focus-visible:block`}>
                  <span className="block">{monthLong(m.key)}</span>
                  {words.map((w) => (
                    <span key={w} className="block tabular-nums">
                      {w}
                    </span>
                  ))}
                  {m.total === 0 ? <span className="block">{m.key > now ? 'Nothing booked yet' : 'Nothing came in'}</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="-mt-1 flex gap-3">
        {months.map((m, i) => (
          <span
            key={m.key}
            className={`flex-1 text-center type-body ${m.key > now ? 'text-zebra-400' : 'text-zebra-950'} ${sparse && i % 2 ? 'invisible' : ''}`}
          >
            {monthShort(m.key)}
          </span>
        ))}
      </div>
    </>
  );
}
