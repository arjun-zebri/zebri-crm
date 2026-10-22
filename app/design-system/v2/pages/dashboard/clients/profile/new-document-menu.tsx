'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

/**
 * A client's New document button and its menu, the same button as the
 * Documents page's (`documents/new-menu.tsx`): "New document" with a
 * plus, a menu of only what can be made, each closing the menu and
 * starting it. Questionnaire is always there; Run sheet, Script and
 * Marriage paperwork only while their blocks are on. Stand-ins that did
 * nothing (Music, Speeches, and Proposal, Contract and Invoice, which a
 * client gets from their journey) are left out (2026-10-14).
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/new-document-menu
 */

export interface NewDocumentMenuProps {
  /** The Run sheets block is on. */
  runSheets: boolean;
  /** The Ceremony scripts block is on. */
  scripts: boolean;
  /** The Lodge with BDM block is on. */
  paperwork: boolean;
  onPaperwork: () => void;
  onRunSheet: () => void;
  onScript: () => void;
  onQuestionnaire: () => void;
}

/** The menu. See {@link NewDocumentMenuProps}. */
export function NewDocumentMenu({
  runSheets,
  scripts,
  paperwork,
  onPaperwork,
  onRunSheet,
  onScript,
  onQuestionnaire,
}: NewDocumentMenuProps) {
  const [open, setOpen] = useState(false);
  const kinds: [string, () => void][] = [
    ['Questionnaire', onQuestionnaire],
    ...(runSheets ? [['Run sheet', onRunSheet] as [string, () => void]] : []),
    ...(scripts ? [['Script', onScript] as [string, () => void]] : []),
    ...(paperwork ? [['Marriage paperwork', onPaperwork] as [string, () => void]] : []),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button icon={<PlusIcon aria-hidden="true" className="size-4" />}>New document</Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="end" role="menu" aria-label="New document">
        {kinds.map(([k, start]) => (
          <MenuOption key={k} onSelect={() => (setOpen(false), start())}>
            {k}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
