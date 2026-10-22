'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { Waterfall } from '@/components/ui-v2/waterfall';

import { InsightsDialog } from '../../payments/overview/insights/insights-dialog';
import type { Advice } from '../advice';
import { DROP_WORDS, type dropOff } from '../insights';

/**
 * From sent to booked, the card the Proposals Overview is built around,
 * on the glass panel as the Payments cash flow chart is. A waterfall from
 * the proposals sent in the period, through where couples stopped, down
 * to the ones booked; the step most couples stopped at is picked out in
 * amber and the line under the title says so in words. A What's next row
 * pointed at lights its couple's step while the rest fade back. Top
 * right, AI insights opens the same split dialog as Payments; an insight
 * that opens a template closes it first, since the builder is a dialog
 * of its own. With nothing to say the button is left out. The plot takes
 * the height the screen has left, so the card sets the row's height.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/overview/sent-to-booked-chart
 */

export interface SentToBookedChartProps {
  d: ReturnType<typeof dropOff>;
  /** The step a rail row points at, a `DROPS` index. */
  focus: number | null;
  insights: Advice[];
  /** Whether an insight's move has been made. */
  isDone: (a: Advice) => boolean;
  /** A nudge from an insight is on its way. */
  busy: boolean;
  onAct: (a: Advice) => void;
}

/** The chart card. See {@link SentToBookedChartProps}. */
export function SentToBookedChart({ d, focus, insights, isDone, busy, onAct }: SentToBookedChartProps) {
  const [open, setOpen] = useState(false);
  const w = d.worst;
  return (
    <Panel as="section" aria-labelledby="sent-booked-title" className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="sent-booked-title" className="type-subheading text-zebra-950">
            From sent to booked
          </h2>
          <p className="type-body text-zebra-500">
            {d.sent === 0
              ? 'No proposals were sent in this period.'
              : `${d.sent} sent, ${d.booked} booked.${w ? ` ${DROP_WORDS[w.stop]}` : ' Every couple made it all the way through.'}`}
          </p>
        </div>
        {insights.length ? (
          <Button variant="ai" className="shrink-0" onClick={() => setOpen(true)}>
            AI insights
          </Button>
        ) : null}
      </div>
      {d.sent > 0 ? (
        <Waterfall
          label="Proposals from sent to booked"
          start={{ label: 'Sent', sub: 'proposals', value: d.sent }}
          drops={d.drops}
          end={{ label: 'Booked', sub: 'deposit paid' }}
          highlight={w?.index}
          focus={focus}
          plotClassName="h-[max(10rem,calc(100dvh-29.375rem))]"
        />
      ) : null}
      <InsightsDialog
        open={open}
        insights={insights}
        isDone={isDone}
        busy={busy}
        onAct={(a) => {
          if (a.action.kind === 'template') setOpen(false);
          onAct(a);
        }}
        onClose={() => setOpen(false)}
      />
    </Panel>
  );
}
