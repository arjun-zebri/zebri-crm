'use client';

import type { Editor } from '@tiptap/react';
import { useState } from 'react';

import { MENU_RULE } from '@/components/ui-v2/control-styles';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { applyTextStyle, type ProposalTheme, type TextState } from '@/features/proposals';
import { FONT_IDS, FONT_LABELS, FONT_STACKS, fontIdFromStack, type FontId } from '@/lib/branding/fonts';

import { BarMenuButton } from '../section-bar/bar-parts';

/**
 * The text bar's first control: the font, by name, opening every font
 * drawn in its own face. The brand kit's two fonts come first, above a
 * hairline, so the usual choice is at the top of a long list.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/font-menu
 */

/** The font menu, for the selection in `editor`. */
export function FontMenu({ editor, state, theme }: { editor: Editor; state: TextState; theme: ProposalTheme }) {
  const [open, setOpen] = useState(false);
  // An override if the words have one; otherwise the brand kit's font for the block they are in.
  const current = fontIdFromStack(state.fontFamily) ?? theme.text[state.style].font;
  const brand = Array.from(new Set([theme.text.heading1.font, theme.text.paragraph.font]));
  const rest = FONT_IDS.filter((f) => !brand.includes(f));
  const row = (f: FontId) => (
    <MenuOption key={f} selected={f === current} onSelect={() => (applyTextStyle(editor, { fontFamily: FONT_STACKS[f] }), setOpen(false))}>
      {/* Each name in its own face, known at runtime. */}
      <span style={{ fontFamily: FONT_STACKS[f] }}>{FONT_LABELS[f]}</span>
    </MenuOption>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarMenuButton label="Font" on={open} className="w-36">
          <span style={{ fontFamily: FONT_STACKS[current] }} className="flex-1 truncate text-left text-zebra-950">
            {FONT_LABELS[current]}
          </span>
        </BarMenuButton>
      </PopoverTrigger>
      <PopoverContent data-text-bar="" size="menu" side="bottom" align="start" aria-label="Font" className="max-h-80 overflow-y-auto">
        {brand.map(row)}
        <div aria-hidden="true" className={MENU_RULE} />
        {rest.map(row)}
      </PopoverContent>
    </Popover>
  );
}
