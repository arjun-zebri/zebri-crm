'use client';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { StatePill } from '@/components/ui/state-pill';

import { Conflict } from './conflict';
import { Demo, DemoGrid, SampleFrame, Spec } from './showroom';

/**
 * Data-display patterns: cards, stat tiles, tables, list rows and the
 * loading / empty / error triad.
 *
 * Reproduced from real page source so the divergence between call sites
 * is visible side by side.
 *
 * @module app/design-system/patterns-data
 */

/** The three card shells in use, verbatim from the dashboard pages. */
const CARD_SHELLS = [
  { cls: 'bg-white rounded-xl border border-gray-200 p-6', where: 'raw palette · 4 uses' },
  { cls: 'bg-surface rounded-xl border border-border p-6', where: 'tokens, legacy radius · 5 uses' },
  { cls: 'rounded-xl border border-border bg-card p-6', where: 'tokens, card surface · 2 uses' },
];

/** Cards, tiles, tables, rows and state surfaces. */
export function PatternsData() {
  return (
    <>
      <Spec name="Card" description="A bordered panel. Three shells exist; none uses the radius token.">
        <div className="space-y-3">
          {CARD_SHELLS.map((c) => (
            <div key={c.cls}>
              <div className={c.cls}>
                <p className="text-sm font-medium">Upcoming weddings</p>
                <p className="mt-1 text-sm text-gray-500">Nothing this week.</p>
              </div>
              <code className="mt-1 block text-caption text-text-subtle">
                {c.cls} · {c.where}
              </code>
            </div>
          ))}
        </div>
      </Spec>

      <Conflict
        title="Three card shells, none of them using rounded-card"
        recommendation={
          <>
            Extract a <code>&lt;Card /&gt;</code> primitive using{' '}
            <code>rounded-card border-border bg-card</code> and one padding scale. The three shells
            above are visually near-identical, which is exactly why the drift went unnoticed and
            will keep spreading.
          </>
        }
      />

      <Spec name="Stat tile" file="app/(dashboard)/dashboard-stats.tsx" description="Metric, delta badge and comparison text.">
        <SampleFrame>
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="text-sm text-gray-500">Total revenue</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-gray-900">$18,400</p>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">$2,010 more than last month</p>
          </div>
        </SampleFrame>
      </Spec>

      <Conflict
        title="The delta badge is a fourth status-chip implementation"
        recommendation={
          <>
            <code>StatBadge</code> in <code>dashboard-stats.tsx</code> uses{' '}
            <code>bg-emerald-50 / bg-red-50</code> with <code>rounded-md</code>, alongside{' '}
            <code>Badge</code> (<code>rounded-full</code>) and <code>StatePill</code> (
            <code>rounded-pill</code>). Fold it into <code>StatePill</code>. Compare the three
            below.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
            +12%
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Paid
          </span>
          <StatePill tone="success" label="Paid" dot="filled" />
          <span className="text-caption text-text-subtle">
            StatBadge · Badge · StatePill
          </span>
        </div>
      </Conflict>

      <Spec name="Table" description="Header row, divided body rows, row hover.">
        <SampleFrame>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Couple', 'Date', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-caption font-medium uppercase tracking-wide text-text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['Alex and Sam', '14 Mar 2027', 'Booked'],
                  ['Priya and Jo', '2 Apr 2027', 'Enquiry'],
                ].map((row) => (
                  <tr key={row[0]} className="transition-colors hover:bg-surface-emphasis">
                    <td className="px-4 py-3 text-text">{row[0]}</td>
                    <td className="px-4 py-3 text-text-muted">{row[1]}</td>
                    <td className="px-4 py-3">
                      <StatePill tone={row[2] === 'Booked' ? 'success' : 'info'} label={row[2] ?? ''} dot="filled" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SampleFrame>
      </Spec>

      <Conflict
        title="Table header cells are styled five different ways"
        recommendation={
          <>
            Header cells across the app vary between <code>text-caption uppercase tracking-wide</code>,{' '}
            plain <code>font-medium</code>, and <code>text-text-muted</code> with no case change,
            with padding from <code>py-2</code> to <code>py-3</code>. Pick one and extract a{' '}
            <code>&lt;DataTable /&gt;</code> shell.
          </>
        }
      >
        <div className="flex flex-wrap gap-6">
          <span className="text-caption font-medium uppercase tracking-wide text-text-muted">Couple</span>
          <span className="text-sm font-medium text-text">Couple</span>
          <span className="whitespace-nowrap text-sm font-medium text-text-muted">Couple</span>
        </div>
      </Conflict>

      <Spec name="List row" description="The dense row used by task and contact lists.">
        <SampleFrame>
          <div className="divide-y divide-border border-t border-border">
            {['Send the run sheet', 'Confirm the venue contact'].map((t) => (
              <div
                key={t}
                className="flex items-start justify-between py-3.5 transition-colors hover:bg-surface-emphasis"
              >
                <div className="min-w-0">
                  <p className="truncate text-body text-text">{t}</p>
                  <p className="text-caption text-text-subtle">Due Friday</p>
                </div>
                <StatePill tone="warning" label="Due" dot="hollow" />
              </div>
            ))}
          </div>
        </SampleFrame>
      </Spec>

      <Spec name="Loading, empty and error" description="The three states every data surface owes the user.">
        <DemoGrid cols={3}>
          <Demo label="Loading">
            <Loading label="Loading couples" />
          </Demo>
          <Demo label="Empty">
            <Empty size="sm" title="No couples yet" description="Enquiries land here." />
          </Demo>
          <Demo label="Error">
            <ErrorState description="Could not load couples." onRetry={() => {}} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="Skeletons and the Loading primitive coexist"
        recommendation={
          <>
            Several lists render bespoke <code>animate-pulse</code> skeleton rows using{' '}
            <code>border-gray-100</code> instead of the <code>Loading</code> primitive, so the same
            page can show a spinner in one panel and a shimmer in the next. Decide which loading
            idiom the app uses and make the other one wrong.
          </>
        }
      >
        <DemoGrid cols={2}>
          <Demo label="Loading primitive">
            <Loading label="Loading" />
          </Demo>
          <Demo label="Bespoke skeleton, as found in lists">
            <div className="space-y-0">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-start justify-between border-b border-gray-100 py-3.5 last:border-0"
                >
                  <div className="space-y-1.5">
                    <div className="h-3 w-40 rounded bg-gray-100" />
                    <div className="h-2.5 w-24 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          </Demo>
        </DemoGrid>
      </Conflict>
    </>
  );
}
