import { Collapse } from '@/components/ui-v2/collapse';

import { ClientAvatars, ClientTitle, NextMove, OpenClient } from './client-parts';
import type { Client } from './clients-data';
import { StageTrack } from './stage-track';
import type { NextMoves } from './use-next-moves';

/**
 * One For you row: the client, where they are on the path, Zebri's read,
 * and the next move at the right edge. No heat badge: the section the
 * row sits in already says how warm they are, and Board and List carry
 * the badge. On phones the parts stack; from `lg` they sit in fixed
 * columns so every row's stage and button line up. A row folds away
 * once its move is done: For you only holds what still needs the MC.
 * Clicking anywhere on the row but the button opens the profile.
 *
 * @module app/design-system/v2/pages/dashboard/clients/for-you-row
 */

/** A For you row. */
export function ForYouRow({
  client,
  moves,
  onOpen,
}: {
  client: Client;
  moves: NextMoves;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <Collapse open={!moves.done.has(client.id)}>
        <div className="relative grid cursor-pointer gap-3 rounded-button px-3 py-4 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none lg:grid-cols-[minmax(0,16rem)_11.5rem_minmax(0,1fr)_9.5rem] lg:items-center lg:gap-10">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatars client={client} />
            <OpenClient client={client} onOpen={onOpen} stretch>
              <ClientTitle client={client} />
            </OpenClient>
          </div>
          <StageTrack client={client} />
          <p className="type-body text-zebra-600">{client.read}</p>
          <div className="relative z-10 lg:justify-self-end">
            <NextMove client={client} moves={moves} />
          </div>
        </div>
      </Collapse>
    </li>
  );
}
