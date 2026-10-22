'use client';

import { useState } from 'react';

import { ArrowDownIcon, ArrowUpIcon, CopyLinkIcon, MoreIcon, BrushIcon, MobileIcon, TrashIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { useDeleteSection, type LayoutAction } from '@/features/proposals';

import type { DocSection } from '../../model/types';
import { useSectionEdit, type SettingsProps } from '../settings/row';

import { BarButton } from './bar-parts';

/**
 * The bar's ⋯ menu: what is done to the section itself (move it,
 * duplicate it, hide it on phones, put it back to the brand, delete it,
 * which asks first when it holds anything, as production's does). What
 * people never reach for (side spacing, full-screen height, a video
 * behind the section) is left out (founder, 2026-10-10); a section that
 * already has it keeps it. The page's header and footer cannot be
 * duplicated.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/bar-menus
 */

/** Sections a page has only one of, by the names the starters give them. */
const ONE_ONLY = new Set(['Header', 'Footer']);

/** One row of the ⋯ menu: an icon and what it does. */
function Act({ icon: Icon, label, onSelect, selected = false }: { icon: ZebriIcon; label: string; onSelect: () => void; selected?: boolean }) {
  return (
    <MenuOption selected={selected} onSelect={onSelect}>
      <Icon aria-hidden="true" className="mr-2.5 size-4 shrink-0 text-zebra-500" />
      {label}
    </MenuOption>
  );
}

/** The ⋯ menu for `section`, at `index` in the page. */
export function ActionsMenu({ builder, section, index }: SettingsProps & { index: number }) {
  const edit = useSectionEdit(builder, section);
  const [open, setOpen] = useState(false);
  // Production's own actions, which the engine's dispatch accepts as they are.
  const dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void = builder.dispatch;
  const { requestDelete, dialog } = useDeleteSection(dispatch);
  const last = builder.state.layout.sections.length - 1;
  const run = (fn: () => void) => () => (fn(), setOpen(false));
  const act = (action: LayoutAction) => run(() => dispatch(action, { commit: true }));
  // A document's working part (its questions, its signatures) is part of every copy: never two, never none.
  const locked = Boolean((section as DocSection).locked);
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <BarButton label="More" on={open} toggle={false}>
            <MoreIcon aria-hidden="true" className="size-4" />
          </BarButton>
        </PopoverTrigger>
        <PopoverContent size="menu" side="bottom" align="end" aria-label="Section actions">
          {index > 0 ? <Act icon={ArrowUpIcon} label="Move up" onSelect={act({ type: 'moveSection', from: index, to: index - 1 })} /> : null}
          {index < last ? <Act icon={ArrowDownIcon} label="Move down" onSelect={act({ type: 'moveSection', from: index, to: index + 1 })} /> : null}
          {locked || ONE_ONLY.has(section.name ?? '') ? null : <Act icon={CopyLinkIcon} label="Duplicate" onSelect={act({ type: 'duplicateSection', id: section.id })} />}
          <Act icon={MobileIcon} label="Hide on phones" selected={Boolean(section.hideOnMobile)} onSelect={run(edit.hideOnPhones)} />
          <Act icon={BrushIcon} label="Back to your brand" onSelect={run(edit.backToBrand)} />
          {locked ? null : <Act icon={TrashIcon} label="Delete" onSelect={run(() => requestDelete(section))} />}
        </PopoverContent>
      </Popover>
      {dialog}
    </>
  );
}
