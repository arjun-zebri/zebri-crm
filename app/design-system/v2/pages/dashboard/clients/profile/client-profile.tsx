'use client';

import { useRef, useState } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';

import type { Client } from '../clients-data';
import type { NextMoves } from '../use-next-moves';

import type { Edit } from './compose-view';
import { ProfileBody } from './profile-body';

/**
 * A client's profile, opened from the Clients page: an extra large v2
 * dialog (full screen on phones). A light grey sidebar on the left holds
 * who the client is and the four sections; the white main area holds
 * the section on screen under its title, More and Close. Reviewing a
 * drafted message takes over the main area; sending returns to the
 * timeline with that step ticked.
 *
 * Sending the first draft is the same move as the button on the
 * client's row, so it marks that move done on the Clients page too.
 *
 * Edits to a draft are kept (per client and step) until it is sent, so
 * switching section or closing the profile never throws them away, and
 * Escape while reviewing a draft steps back to the timeline first.
 *
 * While a video call is on screen the dialog grows to nearly the whole
 * window, easing out and back, so the call has room.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/client-profile
 */

export interface ClientProfileProps {
  /** The client shown; `null` keeps the dialog shut. */
  client: Client | null;
  moves: NextMoves;
  onClose: () => void;
}

/** The profile dialog. See {@link ClientProfileProps}. */
export function ClientProfile({ client, moves, onClose }: ClientProfileProps) {
  // Lives above ProfileBody, which remounts per client, so edits outlast a close.
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  // Set by ProfileBody while a draft is open: Escape goes back instead of closing.
  const back = useRef<(() => void) | null>(null);
  const [onCall, setOnCall] = useState(false);
  return (
    <Dialog
      open={client !== null}
      onClose={() => (back.current ? back.current() : onClose())}
      size="xl"
      expanded={client !== null && onCall}
      aria-labelledby="profile-title"
    >
      {/* Keyed by client, so each opens fresh on Overview. */}
      {client ? (
        <ProfileBody
          key={client.id}
          client={client}
          moves={moves}
          onClose={onClose}
          backRef={back}
          onCallView={setOnCall}
          edits={edits}
          onEdit={(key, e) => setEdits((all) => ({ ...all, [key]: e }))}
          onForget={(key) =>
            setEdits((all) => {
              const rest = { ...all };
              delete rest[key];
              return rest;
            })
          }
        />
      ) : null}
    </Dialog>
  );
}
