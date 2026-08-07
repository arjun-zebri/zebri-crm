'use client';

import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { StatePill } from '@/components/ui/state-pill';

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

/** Cards, tiles, tables, rows and state surfaces. */
export function PatternsData() {
  return (
    <>
      <Spec name="Stat tile" description="Metric, delta and comparison. Built from Card plus StatePill.">
        <SampleFrame>
          <Card>
            <p className="text-body text-text-muted">Total revenue</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-section font-semibold text-text">$18,400</p>
              <StatePill tone="success" label="+12%" />
            </div>
            <p className="mt-1 text-body text-text-subtle">$2,010 more than last month</p>
          </Card>
        </SampleFrame>
      </Spec>

      <Spec name="Table" description="Header row, divided body rows, row hover.">
        <SampleFrame>
          <div className="overflow-hidden rounded-control border border-border bg-card">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  {['Couple', 'Date', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-body font-medium uppercase tracking-wide text-text-muted"
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
                  <p className="text-body text-text-subtle">Due Friday</p>
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

    </>
  );
}
