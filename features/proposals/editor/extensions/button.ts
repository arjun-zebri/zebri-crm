/**
 * The `button` node (spec §2.2): a call-to-action block whose click either
 * opens a link or drives the proposal stepper (accept / decline / jump to
 * a section). `action` is a small tagged object (`model/doc.ts`'s
 * `ButtonAction`), so it round-trips through `data-action` as JSON rather
 * than several separate data attributes.
 *
 * @module features/proposals/editor/extensions/button
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import type { ButtonAction } from '../../model/doc'
import { ButtonView } from '../node-views/button-view'

/** Attributes stored on a `button` node; mirrors `model/doc.ts`'s `ButtonAttrs`. */
export interface ButtonNodeAttrs {
  label: string
  action: ButtonAction
  variant: 'fill' | 'outline'
  size: 'sm' | 'md' | 'lg'
  align: 'left' | 'center' | 'right'
  color?: string
  radius?: number
}

/** Options for {@link ButtonExtension}. */
export interface ButtonOptions {
  /** Render the React `ButtonView` node view (a selection ring over the same button the public page renders) instead of the plain `renderHTML` DOM. */
  nodeViews: boolean
}

const DEFAULT_ACTION: ButtonAction = { kind: 'link', href: 'https://' }

/** Parse the `data-action` JSON attribute, falling back to the default link action for missing or malformed data. */
function parseAction(el: HTMLElement): ButtonAction {
  const raw = el.getAttribute('data-action')
  if (!raw) return DEFAULT_ACTION
  try {
    return JSON.parse(raw) as ButtonAction
  } catch {
    return DEFAULT_ACTION
  }
}

/**
 * Call-to-action button block. Serialises to `data-*` attributes so
 * copy/paste inside the editor survives; renders through `ButtonView` (a
 * React NodeView) when `nodeViews` is configured on.
 */
export const ButtonExtension = Node.create<ButtonOptions>({
  name: 'button',
  group: 'block',
  atom: true,

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(ButtonView) : null
  },

  addAttributes() {
    return {
      label: { default: 'Button', parseHTML: (el: HTMLElement) => el.getAttribute('data-label') ?? 'Button', renderHTML: (attrs: ButtonNodeAttrs) => ({ 'data-label': attrs.label }) },
      action: { default: DEFAULT_ACTION, parseHTML: parseAction, renderHTML: (attrs: ButtonNodeAttrs) => ({ 'data-action': JSON.stringify(attrs.action) }) },
      variant: { default: 'fill', parseHTML: (el: HTMLElement) => el.getAttribute('data-variant') ?? 'fill', renderHTML: (attrs: ButtonNodeAttrs) => ({ 'data-variant': attrs.variant }) },
      size: { default: 'md', parseHTML: (el: HTMLElement) => el.getAttribute('data-size') ?? 'md', renderHTML: (attrs: ButtonNodeAttrs) => ({ 'data-size': attrs.size }) },
      align: { default: 'left', parseHTML: (el: HTMLElement) => el.getAttribute('data-align') ?? 'left', renderHTML: (attrs: ButtonNodeAttrs) => ({ 'data-align': attrs.align }) },
      // Unset stays `undefined`, not `null`: the layout schema declares
      // `color`/`radius` `.optional()`, not `.nullable()` (model/schema.ts).
      color: {
        default: undefined,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-color') || undefined,
        renderHTML: (attrs: ButtonNodeAttrs) => (attrs.color ? { 'data-color': attrs.color } : {}),
      },
      radius: {
        default: undefined,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-radius')
          return raw ? Number(raw) : undefined
        },
        renderHTML: (attrs: ButtonNodeAttrs) => (typeof attrs.radius === 'number' ? { 'data-radius': attrs.radius } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="button"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'button' })]
  },
})
