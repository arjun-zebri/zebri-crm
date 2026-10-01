'use client';

import { useState } from 'react';

import { useAccount } from '../../account';
import { paymentInsights, type PaymentAdvice } from '../advice';
import { summary, type Range } from '../reports-data';
import type { PaymentsState } from '../use-payments-state';

import { CashFlowChart } from './cash-flow-chart';
import { COLUMNS, OverviewStats } from './overview-stats';
import { WhatsNext } from './whats-next';

/**
 * The Overview tab, how the business is doing: the four figures for the
 * period straight on the backdrop, then the cash flow chart beside the
 * What's next rail. The chart runs to the foot of the screen and the
 * rail is pinned to its height, scrolling inside, so both columns end
 * level; on phones the rail comes before the chart, since it is what
 * the MC acts on.
 * Pointing at a rail row lights its month on the chart. The
 * chart's AI insights run here: reminders and nudges go through the
 * page state (so the rail shows them too), and a changed setting is
 * remembered for the visit.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/overview-view
 */

export interface OverviewViewProps {
  range: Range;
  state: PaymentsState;
  /** Opens an invoice; `chase` opens it with the drafted reminder out. */
  onOpen: (id: string, chase?: boolean) => void;
  onOpenContract: (id: string) => void;
  /** Switches to the Invoices tab. */
  onViewAll: () => void;
}

/** The Overview tab. See {@link OverviewViewProps}. */
export function OverviewView({ range, state, onOpen, onOpenContract, onViewAll }: OverviewViewProps) {
  const [focus, setFocus] = useState<string | null>(null);
  const { contracts } = useAccount();
  // Settings an insight changed this visit (demo only: nothing is saved).
  const [applied, setApplied] = useState<ReadonlySet<string>>(() => new Set());
  const act = (a: PaymentAdvice) => {
    if (a.action.kind === 'chase') state.chaseAll(a.action.ids);
    else if (a.action.kind === 'nudge') a.action.ids.forEach(state.remind);
    else setApplied((s) => new Set(s).add(a.id));
  };
  const isDone = (a: PaymentAdvice) =>
    a.action.kind === 'setting' ? applied.has(a.id) : a.action.ids.every((id) => state.reminded.has(id));
  return (
    <div className="space-y-8">
      <OverviewStats s={summary(state.invoices, range)} range={range} onOpen={onViewAll} />
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-y-10 ${COLUMNS}`}>
        <CashFlowChart
          invoices={state.invoices}
          range={range}
          focus={focus}
          insights={paymentInsights(state.invoices, contracts)}
          isDone={isDone}
          busy={state.chasing}
          onAct={act}
        />
        {/* On a wide screen the rail is pinned to the chart's height and
            scrolls inside, so the chart alone sets how tall the row is. */}
        <div className="relative max-lg:order-first">
          <WhatsNext state={state} onFocus={setFocus} onOpen={onOpen} onOpenContract={onOpenContract} onViewAll={onViewAll} />
        </div>
      </div>
    </div>
  );
}
