import { newId, type CanvasElement, type CanvasPage, type TextRole } from '../model';

/**
 * What the rail adds: each a new element sized for an A4 page, before it
 * is placed. Shapes start in the kit's brand colour, text in its role's
 * kit style, so whatever is added already looks like the MC's.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/presets
 */

/** A new element without its position yet. */
// Distributive, so each kind keeps its own fields (a plain Omit over the union keeps only the shared ones).
export type Unplaced = CanvasElement extends infer E ? (E extends CanvasElement ? Omit<E, 'x' | 'y'> : never) : never;

/** Placeholder words per text style, as Canva's "Add a heading". */
export const TEXT_WORDS: Record<TextRole, string> = {
  heading: 'Add a heading',
  subheading: 'Add a subheading',
  body: 'Add a little bit of body text',
  caption: 'Add a caption',
};

const TEXT_WIDTH: Record<TextRole, number> = { heading: 520, subheading: 420, body: 360, caption: 240 };

/** A new text in `role`'s style. */
export const textOf = (role: TextRole): Unplaced => ({
  id: newId(),
  name: role === 'body' ? 'Text' : role[0]!.toUpperCase() + role.slice(1),
  kind: 'text',
  text: TEXT_WORDS[role],
  look: { role },
  w: TEXT_WIDTH[role],
  h: 40,
});

/** A new field: words Zebri fills in (the couple's names, the date). */
export const fieldOf = (field: string, name: string, role: TextRole = 'body'): Unplaced => ({
  id: newId(),
  name,
  kind: 'field',
  field,
  look: { role },
  w: TEXT_WIDTH[role],
  h: 40,
});

/** The shapes the Elements tab offers, in order. */
export const SHAPES = {
  square: (): Unplaced => ({ id: newId(), name: 'Square', kind: 'shape', shape: 'rect', w: 200, h: 200, box: { fill: 'kit:primary' } }),
  rounded: (): Unplaced => ({ id: newId(), name: 'Rounded square', kind: 'shape', shape: 'rect', w: 200, h: 200, box: { fill: 'kit:primary', radius: 24 } }),
  circle: (): Unplaced => ({ id: newId(), name: 'Circle', kind: 'shape', shape: 'ellipse', w: 200, h: 200, box: { fill: 'kit:primary' } }),
  band: (): Unplaced => ({ id: newId(), name: 'Band', kind: 'shape', shape: 'rect', w: 794, h: 120, box: { fill: 'kit:primary' } }),
  line: (): Unplaced => ({ id: newId(), name: 'Line', kind: 'shape', shape: 'line', w: 400, h: 8, box: { fill: 'kit:ink', opacity: 0.2 } }),
} as const;
export type ShapeId = keyof typeof SHAPES;

/** A picture frame, empty or holding `src`. */
export const imageOf = (src: string | null = null, w = 360, h = 240): Unplaced => ({ id: newId(), name: 'Picture', kind: 'image', src, fit: 'cover', w, h });

/** A logo slot showing the kit's logo `variant`. */
export const logoOf = (variant = 'main'): Unplaced => ({ id: newId(), name: 'Logo', kind: 'logo', variant, w: 220, h: 48 });

/** `el` placed on `page`: centred, or at the given point (a drop), and kept on the page. */
export function place(el: Unplaced, page: CanvasPage, at?: { x: number; y: number }): CanvasElement {
  const w = Math.min(el.w, page.width);
  const x = at ? at.x - w / 2 : (page.width - w) / 2;
  const y = at ? at.y - el.h / 2 : (page.height - el.h) / 2;
  const clamp = (v: number, max: number) => Math.round(Math.max(0, Math.min(v, max)));
  return { ...el, w, x: clamp(x, page.width - w), y: clamp(y, page.height - el.h) } as CanvasElement;
}

/** The drag-and-drop type an element preset travels under, from the rail to a page. */
export const DRAG_TYPE = 'application/x-zebri-element';
