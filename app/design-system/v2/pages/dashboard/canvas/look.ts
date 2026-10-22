import { kitColours, type BrandKit, type KitTextStyle } from '../brand/kit';

import type { CanvasDoc, CanvasElement, ColorRef, TextLook, TextRole } from './model';

/**
 * Reading and writing an element's text look the way the toolbar needs:
 * what a text actually wears (its own choices over its role's kit style),
 * and a change applied to "this one" (the selection) or "all like it"
 * (every text of that role). For all like it, the kit's own parts (face,
 * size, weight, spacing, case) are written to the brand kit, so every
 * document follows, and the texts drop their own value for that part;
 * the rest (colour, alignment, italic, underline) has no kit home and is
 * set on every text of the role in this document.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/look
 */

/** A text element: text or a field. */
export type TextElement = Extract<CanvasElement, { look: TextLook }>;

/** The look parts the brand kit holds per role. */
export const KIT_PARTS = ['font', 'size', 'weight', 'lineHeight', 'letterSpacing', 'uppercase'] as const;
type KitPart = (typeof KIT_PARTS)[number];

/** Every look part filled in: the text's own, else its role's. */
// `-?` with NonNullable, not Required: the look's fields are `?: T | undefined`, and Required keeps the undefined.
export type Worn = { [K in keyof Omit<TextLook, 'color'>]-?: NonNullable<TextLook[K]> } & { color: ColorRef };

/** What a text actually wears. */
export function worn(look: TextLook, kit: BrandKit): Worn {
  const k = kit.text[look.role];
  return {
    role: look.role,
    font: look.font ?? k.font,
    size: look.size ?? k.size,
    weight: look.weight ?? k.weight,
    lineHeight: look.lineHeight ?? k.lineHeight,
    letterSpacing: look.letterSpacing ?? k.letterSpacing,
    uppercase: look.uppercase ?? k.uppercase,
    italic: look.italic ?? false,
    underline: look.underline ?? false,
    align: look.align ?? 'left',
    color: look.color ?? 'kit:ink',
  };
}

/** A change to a look. */
export type LookPatch = Partial<Omit<TextLook, 'role'>>;

/** The kit's style for `role` with the kit parts of `patch` written in. */
export function kitWith(kit: BrandKit, role: TextRole, patch: LookPatch): BrandKit {
  const next: Partial<KitTextStyle> = {};
  for (const part of KIT_PARTS) if (patch[part] !== undefined) Object.assign(next, { [part]: patch[part] });
  return Object.keys(next).length ? { ...kit, text: { ...kit.text, [role]: { ...kit.text[role], ...next } } } : kit;
}

/** `look` with `patch` applied for all like it: kit parts cleared (the kit now holds them), the rest set. */
export function followKit(look: TextLook, patch: LookPatch): TextLook {
  const next: TextLook = { ...look };
  for (const [part, value] of Object.entries(patch) as [keyof LookPatch, unknown][]) {
    if ((KIT_PARTS as readonly string[]).includes(part)) delete next[part as KitPart];
    else Object.assign(next, { [part]: value });
  }
  return next;
}

/** Every text in `doc` of `role`. */
export const textsOf = (doc: CanvasDoc, role: TextRole) =>
  doc.pages.flatMap((p) => p.elements).filter((el): el is TextElement => (el.kind === 'text' || el.kind === 'field') && el.look.role === role);

/** A picked colour as a reference: a kit colour stays linked to the kit, anything else is its hex. */
export function refOf(hex: string, kit: BrandKit): ColorRef {
  const match = kitColours(kit).find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return match ? `kit:${match.id}` : hex.toLowerCase();
}
