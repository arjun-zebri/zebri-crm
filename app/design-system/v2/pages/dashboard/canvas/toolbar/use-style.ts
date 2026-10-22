'use client';

import { useState } from 'react';

import { useBrandKit } from '../../brand/brand-provider';
import { followKit, kitWith, textsOf, type LookPatch, type TextElement } from '../look';
import type { BoxLook, CanvasElement } from '../model';
import type { Canvas } from '../use-canvas';

/**
 * How the toolbar changes what is picked. Text changes go to the picked
 * texts ("this one") or to every text of their role ("all like it", which
 * also writes the brand kit, see `look.ts`); box changes always go to the
 * picked elements. `live` changes (a slider mid-drag) share one undo step,
 * closed by `settle`.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/use-style
 */

/** Where a text change lands. */
export type Scope = 'one' | 'all';

/** The style writer for the current selection. */
export function useStyle(canvas: Canvas) {
  const { kit, saveKit } = useBrandKit();
  // Remembered per selection: "all headings" left on would quietly restyle
  // every subheading picked next, so a new pick starts on this one.
  const key = canvas.selected.join(',');
  const [chosen, setChosen] = useState<{ key: string; scope: Scope }>({ key: '', scope: 'one' });
  const scope = chosen.key === key ? chosen.scope : 'one';
  const setScope = (next: Scope) => setChosen({ key, scope: next });
  const picked: CanvasElement[] = canvas.doc.pages.flatMap((p) => p.elements).filter((el) => canvas.selected.includes(el.id));
  const texts = picked.filter((el): el is TextElement => el.kind === 'text' || el.kind === 'field');
  // All like it needs one role to mean anything: two picked roles fall back to this one.
  const role = texts.length && texts.every((t) => t.look.role === texts[0]!.look.role) ? texts[0]!.look.role : null;
  const all = scope === 'all' && role !== null;

  function text(patch: LookPatch, live = false) {
    if (!texts.length) return;
    if (scope === 'all' && role) {
      const next = kitWith(kit, role, patch);
      if (next !== kit) saveKit(next, canvas.doc.title);
      const ids = textsOf(canvas.doc, role).map((t) => t.id);
      canvas.update(ids, (el) => ('look' in el ? { look: followKit(el.look, patch) } : {}), live);
      return;
    }
    canvas.update(texts.map((t) => t.id), (el) => ('look' in el ? { look: { ...el.look, ...patch } } : {}), live);
  }

  function box(patch: BoxLook, live = false) {
    canvas.update(picked.map((el) => el.id), (el) => ({ box: { ...el.box, ...patch } }), live);
  }

  return { kit, picked, texts, role, scope: all ? 'all' : 'one', setScope, text, box, settle: canvas.settle } as const;
}

/** What `useStyle` returns. */
export type Style = ReturnType<typeof useStyle>;
