'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { MoreIcon, TrashIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { Journey } from './journeys-data';
import type { JourneysState } from './use-journeys';

/**
 * The open journey's menu, a ⋯ always shown inside its pill: rename it (in the pill itself), duplicate it, move its pill
 * left or right, make it the one new enquiries start on, or delete it.
 * Deleting asks in a small dialog that says what happens to its clients,
 * and the last journey cannot go.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/journey-menu
 */

export interface JourneyMenuProps {
  journey: Journey;
  state: JourneysState;
  /** Shows a journey's tab, after a duplicate or a delete. */
  onShow: (id: string) => void;
  /** Starts renaming it in place, in its pill. */
  onRename: () => void;
}

/** The menu and its delete dialog. See {@link JourneyMenuProps}. */
export function JourneyMenu({ journey, state, onShow, onRename }: JourneyMenuProps) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const at = state.journeys.findIndex((j) => j.id === journey.id);
  const run = (fn: () => void) => (setOpen(false), fn());
  const count = journey.people.length;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* On the white picked pill: always there, so the journey's options are never hidden.
              Hand-rolled: a 36px square Button would not fit inside the pill. */}
          <button
            type="button"
            aria-label={`${journey.name} options`}
            className={`flex size-6 items-center justify-center rounded-pill text-zebra-400 transition-[color,background-color] duration-150 hover:bg-hover hover:text-zebra-950 focus-mark motion-reduce:transition-none ${open ? 'bg-pressed text-zebra-950' : ''}`}
          >
            <MoreIcon aria-hidden="true" className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent size="menu" align="end" role="menu" aria-label={`${journey.name} options`}>
          <MenuOption onSelect={() => run(onRename)}>Rename</MenuOption>
          <MenuOption onSelect={() => run(() => onShow(state.create(`${journey.name} copy`, journey.id)))}>Duplicate</MenuOption>
          {at > 0 ? <MenuOption onSelect={() => run(() => state.move(journey.id, -1))}>Move left</MenuOption> : null}
          {at < state.journeys.length - 1 ? <MenuOption onSelect={() => run(() => state.move(journey.id, 1))}>Move right</MenuOption> : null}
          <MenuOption selected={Boolean(journey.starts)} onSelect={() => run(() => state.setStarts(journey.id))}>
            New enquiries start here
          </MenuOption>
          {state.journeys.length > 1 ? <MenuOption onSelect={() => run(() => setAsking(true))}>Delete</MenuOption> : null}
        </PopoverContent>
      </Popover>

      <Dialog open={asking} onClose={() => setAsking(false)} size="sm" aria-labelledby="delete-journey">
        <DialogHeader id="delete-journey" icon={TrashIcon} title={`Delete ${journey.name}?`} />
        <DialogBody>
          <p className="type-body text-zebra-500">
            {count ? `The ${count === 1 ? 'client' : `${count} clients`} on it come off it and get nothing more from it. ` : ''}Anything already sent stays as it went.
            {journey.starts ? ' New enquiries start on the next journey instead.' : ''}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="plain" onClick={() => setAsking(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setAsking(false);
              const next = state.journeys[at === 0 ? 1 : at - 1];
              state.remove(journey.id);
              if (next) onShow(next.id);
            }}
          >
            Delete journey
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
