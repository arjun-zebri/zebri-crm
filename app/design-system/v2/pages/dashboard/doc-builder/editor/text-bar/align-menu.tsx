'use client';

import type { Editor } from '@tiptap/react';
import { useState } from 'react';

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { applyTextStyle, type TextState } from '@/features/proposals';

import { BarButton } from '../section-bar/bar-parts';

/**
 * Alignment as one button showing the current one, opening the three
 * ("Left", "Centre", "Right"), so it takes one place on the bar instead
 * of three. The one alignment control: the text bar sets the selected
 * words' ({@link AlignMenu}), the section bar a whole section's
 * ({@link AlignChoice}), both the same menu (2026-10-14).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/align-menu
 */

export type Align = 'left' | 'center' | 'right';

const ALIGNS = [
  { value: 'left', label: 'Left', icon: AlignLeftIcon },
  { value: 'center', label: 'Centre', icon: AlignCenterIcon },
  { value: 'right', label: 'Right', icon: AlignRightIcon },
] as const;

export interface AlignChoiceProps {
  value: Align;
  onPick: (align: Align) => void;
  /** Marks the menu as part of the text bar, so the bubble stays while it is open. */
  textBar?: boolean | undefined;
}

/** The align button and its list. See {@link AlignChoiceProps}. */
export function AlignChoice({ value, onPick, textBar = false }: AlignChoiceProps) {
  const [open, setOpen] = useState(false);
  const Current = ALIGNS.find((a) => a.value === value)!.icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarButton label="Align" on={open} toggle={false}>
          <Current aria-hidden="true" className="size-4" />
        </BarButton>
      </PopoverTrigger>
      <PopoverContent data-text-bar={textBar ? '' : undefined} size="menu" side="bottom" align="start" aria-label="Align">
        {ALIGNS.map(({ value: v, label, icon: Icon }) => (
          <MenuOption key={v} selected={value === v} onSelect={() => (onPick(v), setOpen(false))}>
            <Icon aria-hidden="true" className="mr-2.5 size-4 shrink-0 text-zebra-500" />
            {label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The align menu for the selection in `editor`. */
export function AlignMenu({ editor, state }: { editor: Editor; state: TextState }) {
  return <AlignChoice textBar value={state.align} onPick={(align) => applyTextStyle(editor, { align })} />;
}
