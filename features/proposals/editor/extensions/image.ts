/**
 * The `image` node (spec §2.2): a block image with caption, float layout
 * and a width percentage. Custom rather than `@tiptap/extension-image`,
 * because the spec (`model/schema.ts`) needs those extra attrs, which the
 * stock extension does not carry. `atom` and `draggable`: the image is
 * selected and moved as one unit, never edited from the inside.
 *
 * @module features/proposals/editor/extensions/image
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ImageView } from '../node-views/image-view'

/** Attributes stored on an `image` node; mirrors `model/doc.ts`'s `ImageAttrs`. */
export interface ImageNodeAttrs {
  src: string | null
  alt: string
  caption: string
  layout: 'inline' | 'left' | 'right' | 'full'
  widthPct: number
}

/** Options for {@link ImageExtension}. */
export interface ImageOptions {
  /** Render the React `ImageView` node view (WYSIWYG canvas + resize grips) instead of the plain `renderHTML` DOM. Off by default so schema-only uses (the parity test, `getSchema`) don't need React. */
  nodeViews: boolean
}

/** Parse a numeric `data-*` attribute, falling back to `fallback` for missing or malformed values. */
function numberAttr(el: HTMLElement, name: string, fallback: number): number {
  const raw = el.getAttribute(name)
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Captioned, positioned image block. Serialises to `data-*` attributes so
 * copy/paste inside the editor survives; renders through `ImageView` (a
 * React NodeView) when `nodeViews` is configured on, so the canvas shows
 * the same figure the public page renders, with resize grips.
 */
export const ImageExtension = Node.create<ImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(ImageView) : null
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-src'),
        renderHTML: (attrs: ImageNodeAttrs) => ({ 'data-src': attrs.src }),
      },
      alt: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-alt') ?? '',
        renderHTML: (attrs: ImageNodeAttrs) => ({ 'data-alt': attrs.alt }),
      },
      caption: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption') ?? '',
        renderHTML: (attrs: ImageNodeAttrs) => ({ 'data-caption': attrs.caption }),
      },
      layout: {
        default: 'inline',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-layout') ?? 'inline',
        renderHTML: (attrs: ImageNodeAttrs) => ({ 'data-layout': attrs.layout }),
      },
      widthPct: {
        default: 100,
        parseHTML: (el: HTMLElement) => numberAttr(el, 'data-width-pct', 100),
        renderHTML: (attrs: ImageNodeAttrs) => ({ 'data-width-pct': attrs.widthPct }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="image"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'image' })]
  },
})
