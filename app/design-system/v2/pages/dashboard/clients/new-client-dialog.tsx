'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CallIcon, ClientsIcon, EmailIcon, UserIcon, UserPlusIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import type { NewClient } from '../account';

import { ClientAvatars } from './client-parts';
import { clientName } from './clients-data';
import { NO_DETAILS, NewClientDetails, type Details, NONE } from './new-client-details';

/**
 * New client, built like a premium quick-create (Linear's New issue,
 * Attio's new record) rather than a form, in a large sheet with room to
 * write: the primary contact, then a secondary contact (their partner,
 * for a couple; left empty for a client who is one person), and the
 * title becomes who they are as they are typed ("Priya", then "Priya &
 * Dev", their avatars beside it), the email and phone lines under
 * them, then the event's details as chips (`NewClientDetails`: date,
 * venue, guests, package, where they found you), then the MC's notes,
 * filling the rest of the page with no box. Only the primary contact is
 * needed, so Add client waits for it and nothing says "optional". The two
 * are the client's `names`, so whatever names the partners (the marriage
 * paperwork's first and second partner, the emails' "Hi Priya and Dev")
 * reads them from here. No header or footer bars and no Cancel: the dialog-parts header's quiet Close (the
 * only way out on a phone, where the sheet fills the screen), Escape or a
 * click outside. Each line (the contacts, Email, Phone) is an option G `Input`: led
 * by its icon, its name the grey placeholder while empty, all one size. No
 * keyboard shortcut to add, not even Enter, so a half-typed client is
 * never added by accident.
 *
 * Replaced one Name line split on "&" (user, 2026-10-15: a primary and
 * a secondary contact, each its own field), which itself replaced a
 * five-field two-column form with "(optional)" on most labels, which
 * read as paperwork. Keyed by the caller, but a closed
 * draft is kept (Escape, Close or a click outside is easy to hit with a
 * couple half typed) and comes back on the next opening; adding the
 * client is what clears it.
 *
 * @module app/design-system/v2/pages/dashboard/clients/new-client-dialog
 */

export interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (client: NewClient) => void;
}

/** What was typed into New client and not yet added, kept across a close for this visit. */
interface Draft {
  primary: string;
  secondary: string;
  email: string;
  phone: string;
  details: Details;
  notes: string;
}
const EMPTY: Draft = { primary: '', secondary: '', email: '', phone: '', details: NO_DETAILS, notes: '' };
let kept: Draft = EMPTY;

/** The New client dialog. See {@link NewClientDialogProps}. */
export function NewClientDialog({ open, onClose, onAdd }: NewClientDialogProps) {
  const [primary, setPrimary] = useState(kept.primary);
  const [secondary, setSecondary] = useState(kept.secondary);
  const [email, setEmail] = useState(kept.email);
  const [phone, setPhone] = useState(kept.phone);
  const [details, setDetails] = useState<Details>(kept.details);
  const [notes, setNotes] = useState(kept.notes);
  useEffect(() => {
    kept = { primary, secondary, email, phone, details, notes };
  }, [primary, secondary, email, phone, details, notes]);
  const names: [string, string] = [primary.trim(), secondary.trim()];
  const ready = names[0].length > 0;
  // A secondary contact alone is not yet a client, so the title waits for the primary.
  const title = ready ? clientName({ names }) : 'New client';
  function add() {
    if (!ready) return;
    kept = EMPTY;
    onAdd({
      names,
      email: email.trim(),
      phone: phone.trim(),
      ...details,
      // "" keeps the default journey (left out); No journey is an explicit "".
      journey: details.journey === NONE ? '' : details.journey || undefined,
      venue: details.venue.trim(),
      notes: notes.trim(),
    });
  }
  return (
    <Dialog open={open} onClose={onClose} size="lg" aria-labelledby="add-client-title">
      {/* The title is who they are once the primary contact is typed, with their avatars in place of the icon. */}
      <DialogHeader
        id="add-client-title"
        title={title}
        icon={ClientsIcon}
        leading={ready ? <ClientAvatars client={{ names }} /> : undefined}
      />
      <DialogBody className="flex flex-col gap-6 sm:pt-6">
        {/* Option G: each line led by its icon, its name the grey placeholder until typed, all one size. */}
        <div className="space-y-1">
          <Input
            id="client-primary"
            icon={UserIcon}
            label="Primary contact"
            autoComplete="off"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            data-autofocus
          />
          <Input
            id="client-secondary"
            icon={UserPlusIcon}
            label="Secondary contact"
            autoComplete="off"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
          />
          <Input
            id="client-email"
            icon={EmailIcon}
            label="Email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="client-phone"
            icon={CallIcon}
            label="Phone"
            type="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <NewClientDetails value={details} onChange={setDetails} />
        {/* The rest of the sheet is the MC's to write in, like the body under a Linear issue's title. */}
        <Textarea
          bare
          fill
          rows={3}
          aria-label="Notes"
          placeholder="Notes: what they're after, how you met, anything to remember"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={add} disabled={!ready}>
          Add client
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
