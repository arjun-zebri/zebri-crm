'use client';

import { UserPlus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Textarea } from '@/components/ui-v2/textarea';

import type { NewClient } from '../account';

import { ClientAvatars } from './client-parts';
import { NO_DETAILS, NewClientDetails, type Details } from './new-client-details';

/**
 * New client, built like a premium quick-create (Linear's New issue,
 * Attio's new record) rather than a form, in a large sheet with room to
 * write: the names are one big line typed the way people say them
 * ("Priya & Dev", split on "&" or "and", their avatars replacing the icon beside
 * the title as proof it read a couple), the email and phone quieter lines under
 * it, then the event's details as chips (`NewClientDetails`: date,
 * venue, guests, package, where they found you), then the MC's notes,
 * filling the rest of the page with no box. Only the names are needed,
 * so Add client waits for them and nothing says "optional". No header or
 * footer bars and no Cancel: a quiet × top right (the only way out on a
 * phone, where the sheet fills the screen), Escape or a click outside. No
 * keyboard shortcut to add, not even Enter, so a half-typed client is
 * never added by accident.
 *
 * Replaced a five-field two-column form with "(optional)" on most
 * labels, which read as paperwork. Keyed by the caller, so each opening
 * starts empty.
 *
 * @module app/design-system/v2/pages/dashboard/clients/new-client-dialog
 */

export interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (client: NewClient) => void;
}

/** "Priya & Dev" → ["Priya", "Dev"]; one name for a client who is one person. */
export function splitNames(text: string): [string, string] {
  const [a = '', ...rest] = text.split(/\s*(?:&|\+|\band\b)\s*/i);
  return [a.trim(), rest.join(' ').trim()];
}

/** The New client dialog. See {@link NewClientDialogProps}. */
export function NewClientDialog({ open, onClose, onAdd }: NewClientDialogProps) {
  const [names, setNames] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState<Details>(NO_DETAILS);
  const [notes, setNotes] = useState('');
  const split = splitNames(names);
  const ready = split[0].length > 0;
  function add() {
    if (!ready) return;
    onAdd({
      names: split,
      email: email.trim(),
      phone: phone.trim(),
      ...details,
      venue: details.venue.trim(),
      notes: notes.trim(),
    });
  }
  return (
    <Dialog open={open} onClose={onClose} size="lg" aria-labelledby="add-client-title">
      <div className="flex h-full flex-col gap-6 p-6 sm:p-10">
        <div className="-my-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Beside the title: what this makes, then the couple's avatars once their names are typed. */}
            {ready ? (
              <ClientAvatars client={{ names: split }} />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-pill bg-zebra-100 text-zebra-500">
                <UserPlus aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </span>
            )}
            <h2 id="add-client-title" className="type-label text-zebra-500">
              New client
            </h2>
          </div>
          {/* On a phone the sheet fills the screen, so there is no outside to click: this is the way out. */}
          <Button variant="ghost" square aria-label="Close" onClick={onClose} className="-mr-2">
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </div>
        <div className="space-y-1">
          <InlineInput
            aria-label="Name"
            placeholder="Name"
            autoComplete="off"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            className="mb-8 w-full type-title md:type-display"
            data-autofocus
          />
          <InlineInput
            aria-label="Email"
            type="email"
            placeholder="Email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full type-body"
          />
          {/* A touch more air between the two contact lines, so each reads as its own field. */}
          <InlineInput
            aria-label="Phone"
            type="tel"
            placeholder="Phone"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full type-body"
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
        <div className="flex justify-end">
          <Button onClick={add} disabled={!ready}>
            Add client
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
