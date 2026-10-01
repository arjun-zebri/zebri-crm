'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { InsightDetail } from './insight-detail';
import { TONE, type InsightCard } from './tone';

/**
 * The AI insights dialog, opened from AI insights on the Payments cash
 * flow chart and the Proposals sent-to-booked chart: a list beside the picked insight, in the house modal
 * style. A hairline header (the title and Close, nothing else); on the
 * left the insights as rows, the picked one on the sidebar's soft fill,
 * each a coloured dot and tag, its figure, and the headline; on the
 * right the insight in full (`InsightDetail`). A `split` dialog: fixed
 * height, sized to the longest insight so little is left empty, and
 * switching to a shorter insight never makes it jump (user ruling: a
 * modal never changes height). One way out, Close: a per-insight
 * Dismiss beside it read as a second close. On phones the list stacks
 * above the detail.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/insights/insights-dialog
 */

export interface InsightsDialogProps<A extends InsightCard> {
  open: boolean;
  insights: A[];
  /** Whether an insight's message has gone. */
  isDone: (a: A) => boolean;
  busy: boolean;
  /** Runs an insight's main button. */
  onAct: (a: A) => void;
  onClose: () => void;
}

/** The dialog. See {@link InsightsDialogProps}. */
export function InsightsDialog<A extends InsightCard>({ open, insights, isDone, busy, onAct, onClose }: InsightsDialogProps<A>) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = insights.find((a) => a.id === picked) ?? insights[0];
  return (
    <Dialog open={open} onClose={onClose} size="split" aria-labelledby="ai-insights-title">
      <header className="flex items-center justify-between gap-4 border-b border-zebra-950/5 py-3 pl-6 pr-4">
        <h2 id="ai-insights-title" className="type-subheading text-zebra-950">
          AI insights
        </h2>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </header>
      {current ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:overflow-hidden">
          <ul aria-label="Insights" className="space-y-0.5 border-zebra-950/5 p-3 max-md:border-b md:overflow-y-auto md:border-r">
            {insights.map((a) => {
              const on = a.id === current.id;
              const done = isDone(a);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-current={on || undefined}
                    onClick={() => setPicked(a.id)}
                    className={`w-full space-y-0.5 rounded-button px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
                      on ? 'bg-zebra-950/5' : 'hover:bg-zebra-950/5'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 type-label text-zebra-950">
                        <span aria-hidden="true" className={`size-2 rounded-pill ${done ? 'bg-zebra-300' : TONE[a.tone].dot}`} />
                        {a.tag}
                      </span>
                      <span className="type-body tabular-nums text-zebra-500">{done ? 'Done' : a.metric}</span>
                    </span>
                    <span className={`block pl-4 type-body ${done ? 'text-zebra-400' : 'text-zebra-600'}`}>{a.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <InsightDetail
            key={current.id}
            insight={current}
            done={isDone(current)}
            busy={busy}
            onAct={() => onAct(current)}
          />
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center px-6 type-body text-zebra-500">
          Nothing to flag right now. Zebri adds insights as things change.
        </p>
      )}
    </Dialog>
  );
}
