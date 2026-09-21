'use client'

/**
 * Node view for the `audio` node: renders the same player the public page
 * renders (via the shared `AudioNode`) with a selection ring while
 * selected. A transparent overlay sits over the native `<audio>` controls
 * so a click always selects the node instead of starting playback; the
 * node bar (Task 11) is how the MC changes the src/title.
 *
 * @module features/proposals/editor/node-views/audio-view
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { AudioNode } from '../../render/rich-doc-nodes'
import type { AudioNodeAttrs } from '../extensions/audio'

import { selectNodeOnClick } from './select-node'

/** Editor node view for the `audio` node (registered by `extensions/audio.ts` when `nodeViews` is on). */
export function AudioView({ node, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as AudioNodeAttrs

  return (
    <NodeViewWrapper as="div" data-node-type="audio" className="relative cursor-pointer" onClickCapture={selectNodeOnClick(editor, getPos)}>
      <AudioNode src={attrs.src ?? ''} title={attrs.title || undefined} mode="edit" />
      {/* Above the native controls, below the selection ring: a raw click would otherwise start playback. */}
      <div className="absolute inset-0" />
      {selected ? <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" /> : null}
    </NodeViewWrapper>
  )
}
