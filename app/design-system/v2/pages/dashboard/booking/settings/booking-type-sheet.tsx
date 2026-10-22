'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CalendarClockIcon, MoreIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Textarea } from '@/components/ui-v2/textarea';

import { blankLink, linkUrl, type BookingLink } from '../booking-data';
import { deleteLink, freshSlug, openSheet, saveLink } from '../use-booking-links';

import { BookingPreview } from './booking-preview';
import { BookingTypeChips } from './booking-type-chips';

/**
 * A booking type as a sheet, built like New client: the name as a line
 * led by its icon (option G, all one size), its link quietly under it, the details as chips, then what
 * couples read before they book, filling the rest of the page with no
 * box. Only the name is needed, so Create waits for it. It edits a
 * draft: Create or Save keeps it, and Escape, × or a click outside
 * leaves the type as it was. Delete lives in the ··· menu at the foot's
 * left, away from the fields. Beside it, on wider screens, the booking
 * page couples will see (`BookingPreview`), following every change, so
 * the chips show what they do rather than having to be explained. Laid
 * out as the questionnaire builder is (the two editor-and-preview
 * dialogs share one shape): the dialog header across the top with Close
 * at its right, the editor with its one primary under it (no Cancel),
 * the preview on the grey well with no border. `xl`: at `lg` the form
 * and the preview were too crammed side by side. On a phone the preview
 * sits under the form.
 * Opens over Settings.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-type-sheet
 */

export interface BookingTypeSheetProps {
  /** The type being edited, or undefined for a new one. */
  link: BookingLink | undefined;
}

/** The sheet. Key it by what it opens on, so each opening starts from that. */
export function BookingTypeSheet({ link }: BookingTypeSheetProps) {
  const [draft, setDraft] = useState<BookingLink>(() => link ?? blankLink(freshSlug()));
  const [menu, setMenu] = useState(false);
  const set = (patch: Partial<BookingLink>) => setDraft((d) => ({ ...d, ...patch }));
  const ready = draft.name.trim().length > 0;
  const close = () => openSheet(null);
  return (
    <Dialog open onClose={close} size="xl" aria-labelledby="booking-type-title">
      <div className="flex h-full min-h-0 flex-col">
        <DialogHeader id="booking-type-title" icon={CalendarClockIcon} title={link ? 'Booking type' : 'New booking type'} onClose={close} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
            <DialogBody className="flex flex-col gap-6">
              <div className="space-y-1">
                {/* Not labelled "Name": Chrome reads a lone "Name" field as the name on a
                  card and pops its payment autofill over it, which autoComplete="off"
                  does not stop. */}
                <Input
                  icon={CalendarClockIcon}
                  label="Booking type"
                  name="booking-type-title"
                  autoComplete="off"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  data-autofocus
                />
                {/* The link it will have, so the name reads as the address couples get; under the words, past the icon. */}
                <div className="flex min-h-8 items-center gap-3 pl-7">
                  <span className="min-w-0 truncate type-body text-zebra-500">{ready || link ? linkUrl(draft).replace('https://', '') : 'Your link appears as you name it'}</span>
                  {ready ? <CopyButton value={linkUrl(draft)} variant="ghost" /> : null}
                </div>
              </div>
              <BookingTypeChips value={draft} onChange={set} />
              <Textarea
                fill
                rows={3}
                label="Description"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </DialogBody>
            <DialogFooter>
              {link ? (
                <Popover open={menu} onOpenChange={setMenu}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" square aria-label="More" tooltipSide="top" className="-ml-2 mr-auto">
                      <MoreIcon aria-hidden="true" className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent size="menu" align="start" aria-label="More">
                    <MenuOption onSelect={() => deleteLink(link.slug)}>Delete booking type</MenuOption>
                  </PopoverContent>
                </Popover>
              ) : null}
              <Button onClick={() => saveLink({ ...draft, name: draft.name.trim() })} disabled={!ready}>
                {link ? 'Save' : 'Create booking type'}
              </Button>
            </DialogFooter>
          </div>
          <BookingPreview link={draft} />
        </div>
      </div>
    </Dialog>
  );
}
