import { RowSections } from '@/components/ui-v2/row-sections';

import { GROUPS, type Client } from './clients-data';
import { ForYouRow } from './for-you-row';
import type { NextMoves } from './use-next-moves';

/**
 * The For you view: the clients in sections by urgency (Needs you, Hot,
 * Warm, On track), laid out by the v2 `RowSections`. Each heading counts
 * only the clients whose move is still to do, so sending one ticks the
 * count down as its row folds away.
 *
 * @module app/design-system/v2/pages/dashboard/clients/for-you-view
 */

/** The For you view. `clients` is already searched and filtered. */
export function ForYouView({
  clients,
  moves,
  onOpen,
}: {
  clients: Client[];
  moves: NextMoves;
  onOpen: (id: string) => void;
}) {
  return (
    <RowSections
      sections={GROUPS}
      items={clients}
      sectionOf={(c) => c.group}
      count={(rows) => rows.filter((c) => !moves.done.has(c.id)).length}
      renderRow={(c) => <ForYouRow key={c.id} client={c} moves={moves} onOpen={onOpen} />}
    />
  );
}
