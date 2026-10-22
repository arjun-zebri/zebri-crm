'use client';

import { Fragment, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MENU_RULE } from '@/components/ui-v2/control-styles';
import { DIALOG_HEADER_PAD } from '@/components/ui-v2/dialog-parts';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { ClientsIcon, CloseIcon, MoreIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { STAGES, type Stage } from '../clients-data';

/**
 * The profile's top: Settings' layout (the gold standard, user
 * 2026-10-15). {@link ProfileBar} runs across the whole dialog, its
 * hairline meeting the rail's: the clients circle over the rail's icons,
 * the client's name quiet beside it (as Settings names itself; no big
 * name in the column too, user 2026-10-15), then a section's own buttons (Documents'
 * Upload and New document), More and Close at the right. Corner buttons
 * floating over the name read as out of place once Close moved into
 * the corner (user, 2026-10-15). The event's date, venue and stage live
 * in the Overview's rows now, not under the name (2026-10-09 founder
 * mockup). More holds what the current app's profile header held,
 * grouped by space. Change stage, on an account that can move a client
 * (`onStage`), turns the menu into the stages, the current one checked.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-header
 */

const MORE: string[][] = [
  ['Change stage', 'Change journey', 'Stop Zebri for this client'],
  ['Copy portal link', 'Copy supplier link'],
  ['Start timer', 'Download run sheet', 'Download speeches'],
  ['Rotate portal links', 'Delete client'],
];

/** The padding every part of the main area shares, so their edges line up: Settings' content padding (24px, 40px from md). */
export const GUTTER = 'px-6 md:px-10';
/**
 * Where every section starts under the bar: 12px, the rail's own top, so
 * a section's first row sits level with Overview beside it (user,
 * 2026-10-15: 40px left a gap above Journey that read as odd).
 */
export const TOP = 'pt-3';

export interface ProfileBarProps {
  /** The client's name, in the bar where Settings says "Settings"; also the dialog's accessible name. */
  name: string;
  onClose: () => void;
  /**
   * Where a section puts its own buttons, beside More (Documents' Upload
   * and New document, from md up), so they sit in the top bar rather
   * than a row of their own. The name keeps clear of them.
   */
  slotRef?: ((el: HTMLDivElement | null) => void) | undefined;
  /** A section has buttons in the slot, so it shows. */
  wideCorner?: boolean | undefined;
  /** The client's stage, checked in Change stage. */
  stage?: Stage | undefined;
  /** Moves the client to a stage. Left out (the demo business), Change stage does nothing. */
  onStage?: ((stage: Stage) => void) | undefined;
}

/** The bar across the top of the dialog. See {@link ProfileBarProps}. */
export function ProfileBar({ name, onClose, slotRef, wideCorner = false, stage, onStage }: ProfileBarProps) {
  const [open, setOpen] = useState(false);
  // The menu's two views: More's actions, or the stages Change stage opens.
  const [stages, setStages] = useState(false);
  const show = (o: boolean) => {
    setOpen(o);
    if (!o) setStages(false);
  };
  return (
    <header className={`flex shrink-0 items-center gap-2 border-b border-hairline ${DIALOG_HEADER_PAD}`}>
      <IconCircle icon={ClientsIcon} />
      <h2 id="profile-title" className="min-w-0 truncate type-label text-zebra-500">
        {name}
      </h2>
      <div className="ml-auto flex shrink-0 items-center">
        <div ref={slotRef} className={wideCorner ? 'hidden items-center gap-2 md:mr-2 md:flex' : 'hidden'} />
        <Popover open={open} onOpenChange={show}>
          <PopoverTrigger asChild>
            <Button variant="ghost" square aria-label="More">
              <MoreIcon aria-hidden="true" className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent size="menu" align="end" role="menu" aria-label={stages ? 'Change stage' : 'More'}>
            {stages
              ? STAGES.map((s) => (
                  <MenuOption
                    key={s}
                    selected={s === stage}
                    onSelect={() => {
                      onStage?.(s);
                      show(false);
                    }}
                  >
                    {s}
                  </MenuOption>
                ))
              : MORE.map((group, i) => (
                  <Fragment key={group[0]}>
                    {/* The menus' one separator between groups. */}
                    {i ? <div role="separator" className={MENU_RULE} /> : null}
                    {group.map((item) => (
                      <MenuOption key={item} onSelect={item === 'Change stage' && onStage ? () => setStages(true) : () => undefined}>
                        <span className={item.startsWith('Delete') ? 'text-danger' : undefined}>
                          {item}
                        </span>
                      </MenuOption>
                    ))}
                  </Fragment>
                ))}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <CloseIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </header>
  );
}
