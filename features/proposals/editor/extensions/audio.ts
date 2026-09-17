/**
 * The `audio` node (spec §2.2): a playable audio block (e.g. the couple's
 * processional track) with an optional title and duration.
 *
 * @module features/proposals/editor/extensions/audio
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { AudioView } from '../node-views/audio-view'

/** Attributes stored on an `audio` node. */
export interface AudioNodeAttrs {
  src: string | null
  title: string
  durationSec?: number
}

/** Options for {@link AudioExtension}. */
export interface AudioOptions {
  /** Render the React `AudioView` node view (a selection ring over the same player the public page renders) instead of the plain `renderHTML` DOM. */
  nodeViews: boolean
}

/**
 * Audio player block. Serialises to `data-*` attributes so copy/paste
 * inside the editor survives; renders through `AudioView` (a React
 * NodeView) when `nodeViews` is configured on.
 */
export const AudioExtension = Node.create<AudioOptions>({
  name: 'audio',
  group: 'block',
  atom: true,

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(AudioView) : null
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-src'),
        renderHTML: (attrs: AudioNodeAttrs) => ({ 'data-src': attrs.src }),
      },
      title: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-title') ?? '',
        renderHTML: (attrs: AudioNodeAttrs) => ({ 'data-title': attrs.title }),
      },
      // Unset stays `undefined`, not `null`: the layout schema declares
      // `durationSec` `.optional()`, not `.nullable()` (model/schema.ts).
      durationSec: {
        default: undefined,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-duration-sec')
          return raw ? Number(raw) : undefined
        },
        renderHTML: (attrs: AudioNodeAttrs) => (typeof attrs.durationSec === 'number' ? { 'data-duration-sec': attrs.durationSec } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="audio"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'audio' })]
  },
})
