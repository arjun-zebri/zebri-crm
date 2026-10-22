import { Collapse } from '@/components/ui-v2/collapse';
import { ROW } from '@/components/ui-v2/control-styles';

import { ClientAvatars, ClientTitle, NextMove, OpenClient, READ } from './client-parts';
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
        {/* Name and why share the room left by the fixed stage and action columns: the list sits in a 768 column, where a fixed name width left the why line one word wide. */}
        <div className={`relative grid gap-3 rounded-button px-3 py-4 ${ROW} lg:grid-cols-[minmax(0,1fr)_11.5rem_minmax(0,1fr)_9.5rem] lg:items-center lg:gap-6`}>
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatars client={client} />
            <OpenClient client={client} onOpen={onOpen} stretch>
              <ClientTitle client={client} />
            </OpenClient>
          </div>
          <StageTrack client={client} />
          <p className={READ}>{client.read}</p>
          <div className="relative z-10 lg:justify-self-end">
            <NextMove client={client} moves={moves} />
          </div>
        </div>
      </Collapse>
    </li>
  );
}
