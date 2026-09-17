/**
 * The `spacer` node (spec §2.2): a fixed-height vertical gap between blocks.
 *
 * @module features/proposals/editor/extensions/spacer
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { SpacerView } from '../node-views/spacer-view'

/** Attributes stored on a `spacer` node. */
export interface SpacerNodeAttrs {
  heightPx: number
}

/** Options for {@link SpacerExtension}. */
export interface SpacerOptions {
  /** Render the React `SpacerView` node view (a resize grip on the gap's bottom edge) instead of the plain `renderHTML` DOM. */
  nodeViews: boolean
}

/**
 * Fixed-height vertical gap block. Serialises to `data-*` attributes so
 * copy/paste inside the editor survives; renders through `SpacerView` (a
 * React NodeView) when `nodeViews` is configured on.
 */
export const SpacerExtension = Node.create<SpacerOptions>({
  name: 'spacer',
  group: 'block',
  atom: true,

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(SpacerView) : null
  },

  addAttributes() {
    return {
      heightPx: {
        default: 24,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-height-px')) || 24,
        renderHTML: (attrs: SpacerNodeAttrs) => ({ 'data-height-px': attrs.heightPx }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="spacer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'spacer' })]
  },
})
