import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { HEAT_TONE, clientName, type Client } from './clients-data';
import type { NextMoves } from './use-next-moves';

/**
 * Small pieces every Clients view shares, so a client reads the same on
 * the For you list, the board and the table.
 *
 * @module app/design-system/v2/pages/dashboard/clients/client-parts
 */

/** Both partners' initials, the second tucked behind the first. */
export function ClientAvatars({ client }: { client: Pick<Client, 'names'> }) {
  return (
    <span className="flex shrink-0">
      <Avatar name={client.names[0]} tone="soft" />
      {/* One avatar for a client who is one person. */}
      {client.names[1] ? <Avatar name={client.names[1]} tone="soft" className="-ml-2 ring-2 ring-field" /> : null}
    </span>
  );
}

/** The client's names over the date, then the venue, each truncating. */
export function ClientTitle({ client }: { client: Client }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate type-label text-zebra-950">{clientName(client)}</span>
      {/* Date and venue on their own lines: side by side, the venue was
          the part that got cut off. */}
      <span className="block truncate type-body text-zebra-500">{client.date}</span>
      <span className="block truncate type-body text-zebra-500">{client.venue}</span>
    </span>
  );
}

/** Zebri's heat read as a badge. */
export function HeatBadge({ client }: { client: Client }) {
  return <Badge tone={HEAT_TONE[client.heat]}>{client.heat}</Badge>;
}

/**
 * The client's next move, always a secondary button: a column of solid
 * green down every row made nothing stand out, and the section already
 * says what is urgent. Once sent it hands over in place (`Swap`) to a
 * "Done" status with a tick, at the same height so the row never jumps.
 * Nothing when no move is due.
 */
export function NextMove({ client, moves }: { client: Client; moves: NextMoves }) {
  if (!client.move) return null;
  return (
    <Swap
      active={moves.done.has(client.id) ? 'done' : 'move'}
      className="justify-items-end"
      states={{
        move: (
          <Button
            variant="secondary"
            loading={moves.busy === client.id}
            onClick={() => moves.run(client.id)}
            className="whitespace-nowrap"
          >
            {client.move}
          </Button>
        ),
        done: (
          <Badge size="control" tone="brand">
            <DrawnCheck className="size-3.5" />
            Done
          </Badge>
        ),
      }}
    />
  );
}

/**
 * Opens a client's profile. With `stretch`, its hit area covers the
 * nearest `relative` ancestor (the whole row or card), so anywhere on it
 * opens the profile; controls that must stay clickable on top (the next
 * move) sit in a `relative z-10` wrapper.
 */
export function OpenClient({
  client,
  onOpen,
  stretch = false,
  children,
}: {
  client: Client;
  onOpen: (id: string) => void;
  stretch?: boolean;
  children: ReactNode;
}) {
  return (
    <StretchedButton label={`Open ${clientName(client)}`} onClick={() => onOpen(client.id)} stretch={stretch}>
      {children}
    </StretchedButton>
  );
}
