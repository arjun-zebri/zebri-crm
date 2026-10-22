'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { FilterChip } from '@/components/ui-v2/filter-chip';
import { Panel } from '@/components/ui-v2/panel';

import type { PaymentAdvice } from '../advice';
import type { Invoice } from '../payments-data';
import type { Range } from '../reports-data';

import { CashFlowBars } from './cash-flow-bars';
import { InsightsDialog } from './insights/insights-dialog';
import { SERVICE_SCOPES, SWATCH, scopeOf, slicedMonths } from './slices';

/**
 * Cash flow by month, the card the Overview is built around, on the
 * glass panel. Its header holds the title and the AI insights button
 * (Zebri AI's door, as on the Proposals waterfall) that opens the
 * Insights dialog: what Zebri noticed, listed beside the one to act on.
 * Under it one multi-select `FilterChip` ("Service  All services")
 * scopes the chart to one or more services, with the key beside it. The
 * plot runs to the foot of the screen, and the What's next rail beside
 * it is pinned to the card's height. Colours
 * checked with the dataviz validator: grass-700, danger at 70% and
 * grass-400 pass the colour-blind checks (full-strength danger does not
 * against grass-700).
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/cash-flow-chart
 */

export interface CashFlowChartProps {
  invoices: Invoice[];
  range: Range;
  /** The month a rail row points at. */
  focus: string | null;
  insights: PaymentAdvice[];
  /** Whether an insight's message has gone. */
  isDone: (a: PaymentAdvice) => boolean;
  /** A send from an insight is on its way. */
  busy: boolean;
  onAct: (a: PaymentAdvice) => void;
}

/** The chart card. See {@link CashFlowChartProps}. */
export function CashFlowChart({ invoices, range, focus, insights, isDone, busy, onAct }: CashFlowChartProps) {
  const [services, setServices] = useState<string[]>([]);
  const slice = scopeOf(services);
  const [open, setOpen] = useState(false);
  return (
    <Panel as="section" aria-labelledby="cash-flow-title" className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="cash-flow-title" className="type-subheading text-zebra-950">
          Cash flow by month
        </h2>
        {insights.length ? (
          <Button variant="ai" onClick={() => setOpen(true)}>
            AI insights
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChip
          label="Service"
          placeholder="All services"
          options={SERVICE_SCOPES.map((s) => ({ value: s.id, label: s.label }))}
          value={services}
          onChange={setServices}
        />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 type-body text-zebra-500">
          {(
            [
              ['Received', SWATCH.received],
              ['Overdue', SWATCH.overdue],
              ['To come', SWATCH.toCome],
            ] as const
          ).map(([label, fill]) => (
            <li key={label} className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2.5 rounded-check ${fill}`} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <CashFlowBars months={slicedMonths(invoices, range, slice)} focus={focus} />
      <InsightsDialog
        open={open}
        insights={insights}
        isDone={isDone}
        busy={busy}
        onAct={onAct}
        onClose={() => setOpen(false)}
      />
    </Panel>
  );
}
