import { HOVER_ON_WHITE } from '@/components/ui-v2/control-styles';

import { HeatBadge, NeedsDot, NextMove, OpenClient, READ } from './client-parts';
import { clientName, type Client } from './clients-data';
import type { NextMoves } from './use-next-moves';

/**
 * One client on the board: names and heat, date and venue, Zebri's read
 * clamped to two lines, then how long they have sat in the stage beside
 * the next move. A client who needs the MC gets a red dot before their
 * names rather than a coloured border (v2 draws no boxes around boxes).
 *
 * @module app/design-system/v2/pages/dashboard/clients/board-card
 */

/** A board card. */
export function BoardCard({
  client,
  moves,
  onOpen,
}: {
  client: Client;
  moves: NextMoves;
  onOpen: (id: string) => void;
}) {
  const needs = client.group === 'needs' && !moves.done.has(client.id);
  return (
    <li className={`relative cursor-pointer space-y-3 rounded-button bg-field p-3 shadow-sm transition-colors duration-150 motion-reduce:transition-none ${HOVER_ON_WHITE}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {needs ? <NeedsDot /> : null}
          <span className="min-w-0 flex-1 truncate">
            <OpenClient client={client} onOpen={onOpen} stretch>
              <span className="type-label text-zebra-950">{clientName(client)}</span>
            </OpenClient>
          </span>
          <HeatBadge client={client} />
        </div>
        <p className="truncate type-body text-zebra-500">
          {client.date} · {client.venue}
        </p>
      </div>
      <p className={`line-clamp-2 ${READ}`}>{client.read}</p>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className="min-w-0 truncate type-body text-zebra-400">{client.since}</span>
        <span className="relative z-10">
          <NextMove client={client} moves={moves} />
        </span>
      </div>
    </li>
  );
}
