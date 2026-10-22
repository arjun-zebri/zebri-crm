/**
 * The canvas document model: what every Zebri document is once it opens in
 * the shared Canva-style editor. A document is pages; a page is a size, a
 * background and a stack of elements; an element is a box on the page (its
 * position and size in page pixels, an A4 page being 794 wide) holding one
 * thing: text, a shape, an image, the MC's logo, or a field Zebri fills in
 * (an invoice's total, a couple's names).
 *
 * Colours and text are stored as references to the brand kit where they
 * can be ("kit:primary", the "heading" text style), so a brand change
 * restyles every element that uses it; a hex or a set font is a
 * deliberate one-off. Elements marked `locked` are a document's required
 * parts (GST, totals, signatures): they can be moved and styled but never
 * deleted, and a field's words are always Zebri's.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/model
 */

/** A colour: a kit colour's id as `kit:<id>`, or a hex. */
export type ColorRef = string;

/** The brand kit's text styles; every text element starts from one. */
export type TextRole = 'heading' | 'subheading' | 'body' | 'caption';

/** How text looks. Anything left out comes from the element's text style in the kit. */
export interface TextLook {
  role: TextRole;
  font?: string | undefined;
  /** In page pixels. */
  size?: number | undefined;
  weight?: number | undefined;
  color?: ColorRef | undefined;
  align?: 'left' | 'center' | 'right' | undefined;
  lineHeight?: number | undefined;
  /** In em. */
  letterSpacing?: number | undefined;
  italic?: boolean | undefined;
  uppercase?: boolean | undefined;
  underline?: boolean | undefined;
}

/** How a box looks: its fill, edge and depth. */
export interface BoxLook {
  fill?: ColorRef | null | undefined;
  /** A brand gradient from the fill colour, deepening, as the proposal cover wears. */
  gradient?: boolean | undefined;
  stroke?: ColorRef | null | undefined;
  strokeWidth?: number | undefined;
  radius?: number | undefined;
  shadow?: 'none' | 'soft' | 'lifted' | undefined;
  /** 0 to 1. */
  opacity?: number | undefined;
  /** Inner space, in page pixels, for text and fields. */
  padding?: number | undefined;
}

interface Base {
  id: string;
  /** What the layers list calls it: "Couple's names". */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** In degrees. */
  rotation?: number | undefined;
  /** A required part: moves and styles, never deleted. */
  locked?: boolean | undefined;
  box?: BoxLook | undefined;
}

export type CanvasElement =
  | (Base & { kind: 'text'; text: string; look: TextLook })
  | (Base & { kind: 'shape'; shape: 'rect' | 'ellipse' | 'line' })
  | (Base & { kind: 'image'; src: string | null; fit: 'cover' | 'contain' })
  | (Base & { kind: 'logo'; variant: string })
  /** Words Zebri writes from the document's data (`field` names which), styled like text. */
  | (Base & { kind: 'field'; field: string; look: TextLook })
  /** A working part of the client's page (packages to pick, Pay deposit), drawn by its own component. */
  | (Base & { kind: 'widget'; widget: string });

export type ElementKind = CanvasElement['kind'];

export interface CanvasPage {
  id: string;
  width: number;
  height: number;
  background: ColorRef;
  elements: CanvasElement[];
}

export interface CanvasDoc {
  id: string;
  /** Which document this is: "proposal", "invoice"… */
  kind: string;
  title: string;
  pages: CanvasPage[];
}

/** A4 at 96dpi, the size every printed document is laid out on. */
export const A4 = { width: 794, height: 1123 } as const;

let seq = 0;
/** A fresh element or page id. */
export const newId = (prefix = 'el') => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Every element on every page, with the page it sits on. */
export const allElements = (doc: CanvasDoc) => doc.pages.flatMap((p) => p.elements.map((e) => ({ page: p, el: e })));

/** An element by id. */
export const findElement = (doc: CanvasDoc, id: string) => allElements(doc).find((x) => x.el.id === id);

/** Whether an element carries text styling (text and fields). */
/** Text whose height follows its words (Canva's text boxes): only its width is set by hand. */
export const autoHeight = (el: CanvasElement) => el.kind === 'text' || el.kind === 'field';

export const hasText = (el: CanvasElement): el is Extract<CanvasElement, { look: TextLook }> => el.kind === 'text' || el.kind === 'field';
