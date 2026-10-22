import { A4, type CanvasElement, type CanvasPage, type ColorRef, type TextLook, type TextRole } from '../model';

/**
 * Short builders for the default layouts, so each reads as the page it
 * draws: a text, a field Zebri fills in, a working part, a rule, a logo,
 * and an A4 page. `locked` marks a required part.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/build
 */

type At = { x: number; y: number; w: number; h?: number };
type LookOpts = Omit<TextLook, 'role'> & { locked?: boolean };

const look = (role: TextRole, o: LookOpts = {}): TextLook => {
  const rest: Omit<TextLook, 'role'> & { locked?: boolean } = { ...o };
  delete rest.locked;
  return { role, ...rest };
};

/** Words the MC writes. */
export const text = (id: string, name: string, words: string, role: TextRole, at: At, o: LookOpts = {}): CanvasElement => ({
  id, name, kind: 'text', text: words, look: look(role, o), x: at.x, y: at.y, w: at.w, h: at.h ?? 40, locked: o.locked,
});

/** Words Zebri fills in. */
export const field = (id: string, name: string, key: string, role: TextRole, at: At, o: LookOpts = {}): CanvasElement => ({
  id, name, kind: 'field', field: key, look: look(role, o), x: at.x, y: at.y, w: at.w, h: at.h ?? 40, locked: o.locked,
});

/** A working part. Always required: it carries the document's figures or actions. */
export const part = (id: string, name: string, widget: string, at: Required<At>): CanvasElement => ({
  id, name, kind: 'widget', widget, x: at.x, y: at.y, w: at.w, h: at.h, locked: true,
});

/** A thin rule. */
export const rule = (id: string, at: At, fill: ColorRef = 'kit:ink', opacity = 0.12): CanvasElement => ({
  id, name: 'Line', kind: 'shape', shape: 'line', x: at.x, y: at.y, w: at.w, h: at.h ?? 8, box: { fill, opacity },
});

/** A filled block (a band of colour). */
export const block = (id: string, at: Required<At>, fill: ColorRef = 'kit:primary', radius = 0): CanvasElement => ({
  id, name: 'Band', kind: 'shape', shape: 'rect', x: at.x, y: at.y, w: at.w, h: at.h, box: { fill, radius },
});

/**
 * The brand strip across the top of a page, in the proposal cover's
 * gradient: the contract and invoice wear it so the three documents read
 * as one set (the onboarding look, brought back 2026-10-08).
 */
export const band = (id: string, h = 14): CanvasElement => ({
  id, name: 'Brand strip', kind: 'shape', shape: 'rect', x: 0, y: 0, w: A4.width, h, box: { fill: 'kit:primary', gradient: true },
});

/** A soft wash of the brand colour behind a part, e.g. how to pay. */
export const tint = (id: string, at: Required<At>, opacity = 0.07): CanvasElement => ({
  id, name: 'Brand wash', kind: 'shape', shape: 'rect', x: at.x, y: at.y, w: at.w, h: at.h, box: { fill: 'kit:primary', opacity, radius: 6 },
});

/** The MC's logo. */
export const logo = (id: string, at: Required<At>, variant = 'main'): CanvasElement => ({ id, name: 'Logo', kind: 'logo', variant, x: at.x, y: at.y, w: at.w, h: at.h });

/** A picture frame. */
export const picture = (id: string, at: Required<At>, radius = 0): CanvasElement => ({ id, name: 'Picture', kind: 'image', src: null, fit: 'cover', x: at.x, y: at.y, w: at.w, h: at.h, box: { radius } });

/** An A4 page (or another size). */
export const page = (id: string, elements: CanvasElement[], size: { width: number; height: number } = A4, background: ColorRef = 'kit:paper'): CanvasPage => ({
  id, ...size, background, elements,
});

/** The page's margin and content width, shared by every A4 layout. */
export const M = 64;
export const W = A4.width - M * 2;
