'use client';

import { useCallback, useMemo, useReducer } from 'react';

import { newId, type CanvasDoc, type CanvasElement, type CanvasPage } from './model';

/**
 * The editor's state: the document, what is selected, and the history for
 * undo and redo. Every change goes through one reducer, so undo is exact.
 * A drag or a resize streams many small changes; those pass `live` so
 * only the first of a gesture lands in history (one undo puts the element
 * back where the drag began, not one pixel back).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/use-canvas
 */

/** A change to some elements: a partial element, or a function of each. */
type Patch = Partial<CanvasElement> | ((el: CanvasElement) => Partial<CanvasElement>);

type Action =
  | { type: 'select'; ids: string[] }
  | { type: 'update'; ids: string[]; patch: Patch; live?: boolean }
  | { type: 'add'; page: string; el: CanvasElement }
  | { type: 'remove'; ids: string[] }
  | { type: 'duplicate'; ids: string[] }
  | { type: 'order'; ids: string[]; to: 'front' | 'back' }
  | { type: 'replace'; doc: CanvasDoc }
  | { type: 'pages'; patch: Partial<Pick<CanvasPage, 'background'>> }
  | { type: 'measure'; heights: Record<string, number> }
  | { type: 'addPage'; after: string; page: CanvasPage }
  | { type: 'removePage'; id: string }
  | { type: 'undo' }
  | { type: 'redo' };

interface State {
  doc: CanvasDoc;
  selected: string[];
  past: CanvasDoc[];
  future: CanvasDoc[];
  /** A gesture is streaming: its first change is already in history. */
  live: boolean;
}

/** History is capped so a long session never holds hundreds of copies. */
const DEPTH = 100;

/** Applies a change to every page's elements. */
const mapEls = (doc: CanvasDoc, fn: (els: CanvasElement[]) => CanvasElement[]): CanvasDoc => ({
  ...doc,
  pages: doc.pages.map((p) => ({ ...p, elements: fn(p.elements) })),
});

function edit(doc: CanvasDoc, a: Action): CanvasDoc {
  switch (a.type) {
    case 'update':
      return mapEls(doc, (els) =>
        els.map((e) => (a.ids.includes(e.id) ? ({ ...e, ...(typeof a.patch === 'function' ? a.patch(e) : a.patch) } as CanvasElement) : e)),
      );
    case 'add':
      return { ...doc, pages: doc.pages.map((p) => (p.id === a.page ? { ...p, elements: [...p.elements, a.el] } : p)) };
    case 'remove':
      // Required parts never go: a tax invoice without its GST line is not a tax invoice.
      return mapEls(doc, (els) => els.filter((e) => !a.ids.includes(e.id) || e.locked));
    case 'duplicate':
      return mapEls(doc, (els) =>
        els.flatMap((e) => (a.ids.includes(e.id) && !e.locked ? [e, { ...e, id: newId(), name: `${e.name} copy`, x: e.x + 16, y: e.y + 16 }] : [e])),
      );
    case 'addPage': {
      const at = doc.pages.findIndex((p) => p.id === a.after) + 1;
      return { ...doc, pages: [...doc.pages.slice(0, at), a.page, ...doc.pages.slice(at)] };
    }
    case 'removePage':
      // The last page stays, and so does a page holding a required part.
      return doc.pages.length > 1 && !doc.pages.find((p) => p.id === a.id)?.elements.some((e) => e.locked)
        ? { ...doc, pages: doc.pages.filter((p) => p.id !== a.id) }
        : doc;
    case 'pages':
      return { ...doc, pages: doc.pages.map((p) => ({ ...p, ...a.patch })) };
    case 'order':
      return mapEls(doc, (els) => {
        const moved = els.filter((e) => a.ids.includes(e.id));
        const rest = els.filter((e) => !a.ids.includes(e.id));
        return a.to === 'front' ? [...rest, ...moved] : [...moved, ...rest];
      });
    default:
      return doc;
  }
}

function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'select':
      return { ...s, selected: a.ids, live: false };
    case 'measure':
      // A text's height follows its words: the drawing measured it, so it
      // is a fact about the page, not an edit, and takes no undo step.
      return { ...s, doc: mapEls(s.doc, (els) => els.map((e) => (a.heights[e.id] !== undefined ? { ...e, h: a.heights[e.id]! } : e))) };
    case 'replace':
      return { doc: a.doc, selected: [], past: [], future: [], live: false };
    case 'undo': {
      const prev = s.past.at(-1);
      return prev ? { ...s, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], live: false } : s;
    }
    case 'redo': {
      const next = s.future[0];
      return next ? { ...s, doc: next, past: [...s.past, s.doc], future: s.future.slice(1), live: false } : s;
    }
    default: {
      const doc = edit(s.doc, a);
      const streaming = a.type === 'update' && a.live === true;
      const past = streaming && s.live ? s.past : [...s.past, s.doc].slice(-DEPTH);
      const selected = a.type === 'duplicate' ? [] : a.type === 'add' ? [a.el.id] : s.selected;
      return { doc, selected, past, future: [], live: streaming };
    }
  }
}

/** The editor state for `initial`. */
export function useCanvas(initial: CanvasDoc) {
  const [s, dispatch] = useReducer(reduce, { doc: initial, selected: [], past: [], future: [], live: false });
  const update = useCallback((ids: string[], patch: Patch, live = false) => dispatch({ type: 'update', ids, patch, live }), []);
  return useMemo(
    () => ({
      doc: s.doc,
      selected: s.selected,
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
      select: (ids: string[]) => dispatch({ type: 'select', ids }),
      update,
      /** Ends a streaming gesture, so the next one starts a fresh history entry. */
      settle: () => dispatch({ type: 'select', ids: s.selected }),
      add: (page: string, el: CanvasElement) => dispatch({ type: 'add', page, el }),
      remove: (ids: string[]) => dispatch({ type: 'remove', ids }),
      duplicate: (ids: string[]) => dispatch({ type: 'duplicate', ids }),
      order: (ids: string[], to: 'front' | 'back') => dispatch({ type: 'order', ids, to }),
      /** Restyles every page (its background), as one undo step. */
      pageStyle: (patch: Partial<Pick<CanvasPage, 'background'>>) => dispatch({ type: 'pages', patch }),
      /** Adds a blank page after `after`, the same size and colour. */
      addPage: (after: string) => {
        const from = s.doc.pages.find((p) => p.id === after) ?? s.doc.pages[0]!;
        dispatch({ type: 'addPage', after, page: { ...from, id: newId('page'), elements: [] } });
      },
      /** Copies page `id`, every element given a new id, after itself. */
      duplicatePage: (id: string) => {
        const from = s.doc.pages.find((p) => p.id === id);
        if (from) dispatch({ type: 'addPage', after: id, page: { ...from, id: newId('page'), elements: from.elements.filter((e) => !e.locked).map((e) => ({ ...e, id: newId() })) } });
      },
      /** Removes page `id`, unless it is the last or holds a required part. */
      removePage: (id: string) => dispatch({ type: 'removePage', id }),
      /** Records texts' drawn heights (no undo step). */
      measure: (heights: Record<string, number>) => dispatch({ type: 'measure', heights }),
      replace: (doc: CanvasDoc) => dispatch({ type: 'replace', doc }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
    }),
    [s, update],
  );
}

export type Canvas = ReturnType<typeof useCanvas>;
