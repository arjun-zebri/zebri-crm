import { Button } from '@/components/ui-v2/button';

import { expiringSoon, openedNotAccepted } from '../insights';
import type { ProposalsState } from '../use-proposals-state';

import { RailRow, type RailKind } from './rail-row';

/**
 * The Proposals What's next rail beside the chart, straight on the
 * backdrop, as on the Payments Overview: one list of what needs the MC
 * now, as of today. Couples who opened and have not said yes come first
 * (most recent and most frequent readers first), then proposals that
 * expire in the next two weeks, soonest first; a proposal in both shows
 * once, as a reader. Every row has the same shape (`RailRow`). The list
 * scrolls inside the rail, so the chart sets the Overview's height.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/overview/whats-next
 */

export interface WhatsNextProps {
  state: ProposalsState;
  /** Lights a step on the chart while a row is pointed at. */
  onFocus: (step: number | null) => void;
  /** Opens a proposal; `nudge` opens it with the drafted nudge out. */
  onOpen: (id: string, nudge?: boolean) => void;
  /** Goes to the Proposals tab. */
  onViewAll: () => void;
}

/** The rail. See {@link WhatsNextProps}. */
export function WhatsNext({ state, onFocus, onOpen, onViewAll }: WhatsNextProps) {
  const opened = openedNotAccepted(state.proposals);
  const shown = new Set(opened.map((p) => p.id));
  const items: { kind: RailKind; proposal: (typeof opened)[number] }[] = [
    ...opened.map((proposal) => ({ kind: 'opened' as const, proposal })),
    ...expiringSoon(state.proposals)
      .filter((p) => !shown.has(p.id))
      .map((proposal) => ({ kind: 'expiring' as const, proposal })),
  ];
  return (
    <section aria-labelledby="proposals-next-title" className="flex min-h-0 flex-col lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-4">
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-zebra-950/15 pb-2">
        <h2 id="proposals-next-title" className="type-subheading text-zebra-950">
          What&rsquo;s next
        </h2>
        <Button variant="plain" onClick={onViewAll}>
          All proposals
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="pt-3 type-body text-zebra-500">No one is sitting on a proposal and nothing expires in the next two weeks.</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-zebra-950/5 overflow-y-auto">
          {items.map(({ kind, proposal }) => (
            <li key={proposal.id}>
              <RailRow
                proposal={proposal}
                kind={kind}
                nudged={state.nudged}
                busy={state.nudging}
                onOpen={(nudge) => onOpen(proposal.id, nudge)}
                onFocus={onFocus}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
