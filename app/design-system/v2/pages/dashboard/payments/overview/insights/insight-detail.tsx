import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { TONE, type InsightCard } from './tone';

/**
 * The right side of the AI insights dialog (Payments and Proposals), laid out like the
 * document modal's side column: the headline (the tag and figure are
 * on the picked row beside it, so they are not repeated here), what
 * Zebri found (the numbers, in a sentence or two), what is behind it
 * as a plain label-and-value list, and the one move to make. No drafted
 * message in here: the button does the move (sends Zebri's reminder,
 * nudges, or changes the setting) and hands over to a tick in place.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/insights/insight-detail
 */

export interface InsightDetailProps {
  insight: InsightCard;
  /** The move has been made. */
  done: boolean;
  /** A send is on its way. */
  busy: boolean;
  onAct: () => void;
}

/** The detail. See {@link InsightDetailProps}. */
export function InsightDetail({ insight: a, done, busy, onAct }: InsightDetailProps) {
  const tone = TONE[a.tone];
  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <h3 className="type-subheading text-zebra-950">{a.title}</h3>
          <p className="type-body text-zebra-700">{a.why}</p>
        </div>
        <section aria-labelledby="insight-behind" className="space-y-3">
          <h4 id="insight-behind" className="type-body text-zebra-500">
            Behind it
          </h4>
          <ul className="space-y-2.5 type-body">
            {a.rows.map((r) => (
              <li key={r.name} className="flex items-baseline justify-between gap-4">
                <span className="text-zebra-950">{r.name}</span>
                <span className={`text-right tabular-nums ${a.tone === 'brand' ? 'text-zebra-500' : tone.text}`}>{r.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="insight-move" className="space-y-2">
          <h4 id="insight-move" className="type-body text-zebra-500">
            What to do
          </h4>
          <p className="type-body text-zebra-950">{a.move}</p>
        </section>
      </div>
      <footer className="flex items-center justify-end border-t border-zebra-950/5 px-6 py-3">
        <Swap
          active={done ? 'done' : 'act'}
          className="justify-items-end"
          states={{
            act: (
              <Button loading={busy} onClick={onAct}>
                {a.label}
              </Button>
            ),
            done: (
              <Badge size="control" tone="brand">
                <DrawnCheck className="size-3.5" />
                {a.doneLabel}
              </Badge>
            ),
          }}
        />
      </footer>
    </div>
  );
}
