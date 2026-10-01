import { Panel } from '@/components/ui-v2/panel';

import { BoardCard } from './board-card';
import { STAGES, type Client } from './clients-data';
import type { NextMoves } from './use-next-moves';

/**
 * The Board view: one column per stage on the booking path, scrolling
 * sideways when they do not fit. Each column says how many of its
 * clients need the MC, so the eye goes to the right column first.
 *
 * @module app/design-system/v2/pages/dashboard/clients/board-view
 */

/** The Board view. `clients` is already searched and filtered. */
export function BoardView({
  clients,
  moves,
  onOpen,
}: {
  clients: Client[];
  moves: NextMoves;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {STAGES.map((stage) => {
          const cards = clients.filter((c) => c.stage === stage);
          const needs = cards.filter((c) => c.group === 'needs' && !moves.done.has(c.id)).length;
          return (
            <Panel
              as="section"
              key={stage}
              aria-label={stage}
              className="w-72 shrink-0 space-y-2 self-start p-2"
            >
              <header className="flex items-center gap-2 px-2 pt-1">
                <h3 className="type-label text-zebra-950">{stage}</h3>
                <span className="type-body tabular-nums text-zebra-400">{cards.length}</span>
                {needs > 0 ? (
                  <span className="ml-auto flex items-center gap-1.5 type-body text-zebra-500">
                    <span aria-hidden="true" className="size-1.5 rounded-pill bg-danger" />
                    {needs} need{needs === 1 ? 's' : ''} you
                  </span>
                ) : null}
              </header>
              {cards.length > 0 ? (
                <ul className="space-y-2">
                  {cards.map((c) => (
                    <BoardCard key={c.id} client={c} moves={moves} onOpen={onOpen} />
                  ))}
                </ul>
              ) : (
                <p className="px-2 pb-2 type-body text-zebra-400">Nobody here yet</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
