'use client';

import type { Editor } from '@tiptap/react';
import { useState } from 'react';

import { CaseSensitiveIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { applyTextStyle, type CaseValue, type TextState } from '@/features/proposals';

import { BarButton } from '../section-bar/bar-parts';

/**
 * Text case on the bar: an Aa button opening the cases, each written
 * the way it comes out.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/case-menu
 */

const CASES: { value: CaseValue; label: string }[] = [
  { value: 'none', label: 'As typed' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'capitalize', label: 'Title Case' },
  { value: 'uppercase', label: 'CAPITALS' },
  { value: 'lowercase', label: 'lowercase' },
];

/** The case button and its list, for the selection in `editor`. */
export function CaseMenu({ editor, state }: { editor: Editor; state: TextState }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarButton label="Text case" on={open || state.textCase !== 'none'} toggle={false}>
          <CaseSensitiveIcon aria-hidden="true" className="size-4" />
        </BarButton>
      </PopoverTrigger>
      <PopoverContent data-text-bar="" size="menu" side="bottom" align="start" aria-label="Text case">
        {CASES.map((c) => (
          <MenuOption key={c.value} selected={state.textCase === c.value} onSelect={() => (applyTextStyle(editor, { textCase: c.value }), setOpen(false))}>
            {c.label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
