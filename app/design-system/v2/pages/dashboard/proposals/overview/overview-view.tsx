'use client';

import { useState } from 'react';

import type { Range } from '../../payments/reports-data';
import { insightsFor, type Advice } from '../advice';
import { dropOff, summary } from '../insights';
import type { TemplateId } from '../templates-data';
import type { ProposalsState } from '../use-proposals-state';

import { COLUMNS, OverviewStats } from './overview-stats';
import { SentToBookedChart } from './sent-to-booked-chart';
import { WhatsNext } from './whats-next';

/**
 * The Proposals Overview tab, how selling is going, laid out as the
 * Payments Overview: the four figures for the period straight on the
 * backdrop, then the sent-to-booked card beside the What's next rail
 * (couples who opened and have not said yes, then what expires in the
 * next two weeks). Pointing at a rail row lights its couple's step on
 * the chart. The figures and chart follow the period control; the rail
 * is always as of today, since it is about what to do now. The chart's
 * AI insights run here: nudges go through the page state (so the rail
 * shows them too), and a template opens in the builder.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/overview/overview-view
 */

export interface OverviewViewProps {
  range: Range;
  state: ProposalsState;
  /** Opens a proposal; `nudge` opens it with the drafted nudge out. */
  onOpen: (id: string, nudge?: boolean) => void;
  /** Switches to the Proposals tab. */
  onViewAll: () => void;
  /** Opens a template in the builder, from an AI insight. */
  onEditTemplate: (template: TemplateId) => void;
}

/** The Overview tab. See {@link OverviewViewProps}. */
export function OverviewView({ range, state, onOpen, onViewAll, onEditTemplate }: OverviewViewProps) {
  const [focus, setFocus] = useState<number | null>(null);
  const act = (a: Advice) => {
    if (a.action.kind === 'nudge') state.nudgeAll(a.action.ids);
    else onEditTemplate(a.action.template);
  };
  // A template insight is never "done": the builder is where the change happens.
  const isDone = (a: Advice) => a.action.kind === 'nudge' && a.action.ids.every((id) => state.nudged.has(id));
  return (
    <div className="space-y-8">
      <OverviewStats s={summary(state.proposals, range)} onOpen={onViewAll} />
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-y-8 ${COLUMNS}`}>
        <SentToBookedChart
          d={dropOff(state.proposals, range)}
          focus={focus}
          insights={insightsFor(state.proposals, range)}
          isDone={isDone}
          busy={state.nudging}
          onAct={act}
        />
        {/* On a wide screen the rail is pinned to the chart's height and
            scrolls inside, so the chart alone sets how tall the row is. */}
        <div className="relative">
          <WhatsNext state={state} onFocus={setFocus} onOpen={onOpen} onViewAll={onViewAll} />
        </div>
      </div>
    </div>
  );
}
