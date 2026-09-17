/**
 * The `embed` node (spec §2.2): an external video / map / audio embed,
 * gated to an allowlisted set of hosts by `detectEmbedProvider`. `setEmbed`
 * is the only way a command can set the node's url, so an unrecognised
 * host can never reach the document through the editor UI (the slash menu
 * and paste-to-embed both go through it, see Task 11).
 *
 * @module features/proposals/editor/extensions/embed
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { detectEmbedProvider } from '../../model/rich-doc-spec'
import { EmbedView } from '../node-views/embed-view'

/** Attributes stored on an `embed` node. */
export interface EmbedNodeAttrs {
  url: string | null
}

/** Options for {@link EmbedExtension}. */
export interface EmbedOptions {
  /** Render the React `EmbedView` node view (a selection ring over the same iframe the public page renders) instead of the plain `renderHTML` DOM. */
  nodeViews: boolean
}

/**
 * Allowlisted external embed block (YouTube, Vimeo, Spotify, Google Maps,
 * Instagram, the Zebri scheduler). Serialises to `data-*` attributes so
 * copy/paste inside the editor survives; renders through `EmbedView` (a
 * React NodeView) when `nodeViews` is configured on.
 */
export const EmbedExtension = Node.create<EmbedOptions>({
  name: 'embed',
  group: 'block',
  atom: true,

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(EmbedView) : null
  },

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-url'),
        renderHTML: (attrs: EmbedNodeAttrs) => ({ 'data-url': attrs.url }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="embed"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'embed' })]
  },

  addCommands() {
    return {
      setEmbed:
        (url: string) =>
        ({ chain }) => {
          // The allowlist boundary: a url whose host `detectEmbedProvider`
          // does not recognise is refused here, not filtered later at render.
          if (detectEmbedProvider(url) === null) return false
          return chain().insertContent({ type: this.name, attrs: { url } }).run()
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      /** Insert an embed node for `url`, or do nothing (return `false`) if its host is not allowlisted. */
      setEmbed: (url: string) => ReturnType
    }
  }
}
