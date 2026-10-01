import { Panel } from '@/components/ui-v2/panel';

import { ClientAvatars, HeatBadge, NextMove, OpenClient } from './client-parts';
import { GROUPS, clientName, type Client } from './clients-data';
import type { NextMoves } from './use-next-moves';

/**
 * The List view: every client as one table row, most urgent first (the
 * For you order). Clicking anywhere on a row but its Next move button
 * opens the profile, as on For you and the board: the client's name is
 * a stretched button covering the row. Rows are separated by space and a hover fill, not
 * rules. Stage, event and Zebri's read drop out on narrow screens,
 * leaving client, heat and next move; a phone keeps just the client
 * and the next move.
 *
 * @module app/design-system/v2/pages/dashboard/clients/list-view
 */

const ORDER = GROUPS.map((g) => g.id);
const TH = 'px-3 pb-2 pt-2 text-left type-body font-normal text-zebra-400';
const TD = 'px-3 py-3 first:rounded-l-button last:rounded-r-button';

/** The List view. `clients` is already searched and filtered. */
export function ListView({
  clients,
  moves,
  onOpen,
}: {
  clients: Client[];
  moves: NextMoves;
  onOpen: (id: string) => void;
}) {
  const rows = [...clients].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
  return (
    <Panel className="overflow-x-auto p-2">
      <table className="w-full min-w-0 border-separate border-spacing-0 type-body">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Client
            </th>
            <th scope="col" className={`${TH} hidden md:table-cell`}>
              Stage
            </th>
            <th scope="col" className={`${TH} hidden lg:table-cell`}>
              Event
            </th>
            <th scope="col" className={`${TH} hidden sm:table-cell`}>
              Heat
            </th>
            <th scope="col" className={`${TH} hidden xl:table-cell`}>
              Zebri&apos;s read
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Next move
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const needs = c.group === 'needs' && !moves.done.has(c.id);
            return (
              <tr
                key={c.id}
                // `relative` anchors the name's stretched button to the whole row.
                className="relative cursor-pointer transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none"
              >
                <td className={TD}>
                  <span className="flex items-center gap-3">
                    <ClientAvatars client={c} />
                    <OpenClient client={c} onOpen={onOpen} stretch>
                      <span className="truncate type-label text-zebra-950">
                        {clientName(c)}
                      </span>
                    </OpenClient>
                    {needs ? (
                      <span className="size-1.5 shrink-0 rounded-pill bg-danger">
                        <span className="sr-only">Needs you</span>
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className={`${TD} hidden text-zebra-700 md:table-cell`}>{c.stage}</td>
                <td className={`${TD} hidden whitespace-nowrap lg:table-cell`}>
                  <span className="text-zebra-950">{c.date}</span>
                  <span className="block text-zebra-400">{c.since}</span>
                </td>
                <td className={`${TD} hidden sm:table-cell`}>
                  <HeatBadge client={c} />
                </td>
                <td className={`${TD} hidden max-w-md text-zebra-700 xl:table-cell`}>
                  <span className="line-clamp-2">{c.read}</span>
                </td>
                <td className={`${TD} text-right`}>
                  <span className="relative z-10 inline-flex justify-end">
                    {c.move ? (
                      <NextMove client={c} moves={moves} />
                    ) : (
                      <span className="text-zebra-400">Nothing due</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
