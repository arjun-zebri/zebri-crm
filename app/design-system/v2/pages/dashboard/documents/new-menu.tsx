'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { BarIcons } from '../bar-icons';

import type { DocumentKind, KindInfo } from './kinds';

/**
 * The Documents page's one primary, New document: a menu of the kinds
 * the MC can write a template for (marriage paperwork has none, so it is
 * left out), each starting that kind's new template. The same button as
 * a client's New document (`clients/profile/new-document-menu.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/documents/new-menu
 */

/** The menu. `kinds` are the added ones; `onNew` starts a template of one. */
export function NewMenu({
  kinds,
  onNew,
}: {
  kinds: KindInfo[];
  onNew: (kind: DocumentKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const writable = kinds.filter((k) => k.id !== 'paperwork');
  if (!writable.length) return null;
  return (
    <BarIcons>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            square
            aria-label="New document"
            tooltip={false}
            data-tour="new-document"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
          </Button>
        </PopoverTrigger>
        {/* 7px: a menu's 4px gap, plus the 3px the + sits inside its glass pill (BarIcons), so the gap is from the pill. */}
        <PopoverContent
          size="menu"
          align="end"
          sideOffset={7}
          role="menu"
          aria-label="New document"
        >
          {writable.map((k) => (
            <MenuOption key={k.id} onSelect={() => (setOpen(false), onNew(k.id))}>
              {k.one}
            </MenuOption>
          ))}
        </PopoverContent>
      </Popover>
    </BarIcons>
  );
}
