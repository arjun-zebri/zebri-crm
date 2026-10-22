'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { MoveHorizontalIcon } from '@/components/ui-v2/icons';
import { Tooltip } from '@/components/ui-v2/tooltip';
import { effectiveWidth, pxToWidth, widthToPx } from '@/features/proposals';

import { useSectionEdit, type SettingsProps } from '../settings/row';

/**
 * Width, as one number in the bar, the way Figma and Framer set a size
 * (founder, 2026-10-10: "is this really how a premium app would handle
 * this?" of a popover holding a slider and a box for the same number).
 * Type it and press Enter, nudge it with the arrow keys (10px, 50 with
 * Shift), or drag the arrows icon sideways to scrub it. A drag or a
 * typed value is one undo step. Held in production's own range (the one
 * its width handles used); a width that lands on a named stop (560,
 * 720, 1100) is stored as that name, as production stores it.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/width-menu
 */

/** Production's width range, from its width handles (`section-width-handles.tsx`). */
const MIN = 320;
const MAX = 1400;

/** `px` held inside the range, on whole pixels. */
const clamp = (px: number) => Math.min(MAX, Math.max(MIN, Math.round(px)));

/** The width field, for `section`. */
export function WidthMenu({ builder, section }: SettingsProps) {
  const edit = useSectionEdit(builder, section);
  const px = widthToPx(effectiveWidth(section.style.contentWidth, builder.theme));
  // While typing, the field holds what was typed; Enter or leaving it applies it.
  const [typed, setTyped] = useState<string | null>(null);
  const set = (next: number, commit: boolean) => edit.style({ contentWidth: pxToWidth(clamp(next)) }, commit ? { commit: true } : undefined);
  const apply = () => {
    const n = Number(typed);
    if (typed !== null && Number.isFinite(n) && n > 0) set(n, true);
    setTyped(null);
  };
  const nudge = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') return e.currentTarget.blur();
    if (e.key === 'Escape') return setTyped(null);
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setTyped(null);
    set(px + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 50 : 10), true);
  };
  // Scrubbing: every 2px of drag is 1px of width; the last value is committed once on release.
  const last = useRef(px);
  const scrub = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const start = { x: e.clientX, px };
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      last.current = clamp(start.px + (m.clientX - start.x) * 2);
      set(last.current, false);
    };
    const up = () => {
      set(last.current, true);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    last.current = px;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  return (
    <label className="flex h-9 items-center gap-1 rounded-panel pl-1.5 pr-2 transition-colors duration-150 hover:bg-hover focus-within:bg-hover motion-reduce:transition-none">
      <Tooltip side="top" label="Width: drag, or type a number">
        <span onPointerDown={scrub} className="flex size-5 cursor-ew-resize touch-none items-center justify-center text-zebra-500">
          <MoveHorizontalIcon aria-hidden="true" className="size-4" />
        </span>
      </Tooltip>
      <input
        aria-label="Width in pixels"
        inputMode="numeric"
        value={typed ?? String(px)}
        onChange={(e) => setTyped(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={apply}
        onKeyDown={nudge}
        className="w-10 bg-transparent text-right type-numeric text-zebra-950 outline-none"
      />
      <span aria-hidden="true" className="type-body text-zebra-400">
        px
      </span>
    </label>
  );
}
