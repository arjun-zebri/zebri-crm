'use client';

import type { Editor } from '@tiptap/react';
import { useState, type KeyboardEvent } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui-v2/icons';
import { applyTextStyle, type ProposalTheme, type TextState } from '@/features/proposals';

import { BarButton } from '../section-bar/bar-parts';

/**
 * Font size, as one number on the bar, the way the section bar sets
 * Width: type it and press Enter, step it with the < and > either side
 * (founder, 2026-10-10), or nudge it with the arrow keys (1px, 4 with
 * Shift). It shows the brand kit's size for the block until the
 * words are given their own.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/size-field
 */

/** Production's own size bounds (`text-bar-selects.tsx`): smaller is unreadable, larger outgrows every width. */
const MIN = 8;
const MAX = 120;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

/** The size field, for the selection in `editor`. */
export function SizeField({ editor, state, theme }: { editor: Editor; state: TextState; theme: ProposalTheme }) {
  const size = Math.round(state.fontSize !== null ? parseFloat(state.fontSize) : theme.text[state.style].size);
  // While typing, the field holds what was typed; Enter or leaving it applies it.
  const [typed, setTyped] = useState<string | null>(null);
  const set = (n: number) => applyTextStyle(editor, { fontSize: `${clamp(n)}px` });
  const apply = () => {
    const n = Number(typed);
    if (typed !== null && Number.isFinite(n) && n > 0 && n !== size) set(n);
    setTyped(null);
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') return apply();
    if (e.key === 'Escape') return setTyped(null);
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setTyped(null);
    set(size + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 4 : 1));
  };
  return (
    <div className="flex items-center">
      <BarButton label="Smaller" disabled={size <= MIN} onClick={() => set(size - 1)}>
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
      </BarButton>
      <label className="flex h-9 items-center gap-0.5 rounded-panel px-1.5 transition-colors duration-150 hover:bg-hover focus-within:bg-hover motion-reduce:transition-none">
        <input
          aria-label="Font size"
          inputMode="numeric"
          value={typed ?? String(size)}
          onChange={(e) => setTyped(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={apply}
          onKeyDown={keys}
          className="w-6 bg-transparent text-right type-numeric text-zebra-950 outline-none"
        />
        <span aria-hidden="true" className="type-body text-zebra-400">
          px
        </span>
      </label>
      <BarButton label="Bigger" disabled={size >= MAX} onClick={() => set(size + 1)}>
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </BarButton>
    </div>
  );
}
