'use client'

/**
 * Node view for the `embed` node: renders the same allowlisted iframe the
 * public page renders (via the shared `EmbedNode`) with a selection ring
 * while selected. A transparent overlay sits over the iframe so a click
 * always selects the node instead of being swallowed by the embedded
 * page; the node bar (Task 11) is how the MC changes the url.
 *
 * `insert-media-host.tsx`'s `EmbedInsertModal` prompts for a url before an
 * embed node can exist at all, so a `null` url can only reach here on a
 * document written before that fix (or a hand-edited one) - the dashed
 * placeholder below keeps that state discoverable instead of rendering an
 * invisible gap in the section (final review Finding 2).
 *
 * @module features/proposals/editor/node-views/embed-view
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { EmbedNode } from '../../render/rich-doc-nodes'
import type { EmbedNodeAttrs } from '../extensions/embed'

import { selectNodeOnClick } from './select-node'

/** Editor node view for the `embed` node (registered by `extensions/embed.ts` when `nodeViews` is on). */
export function EmbedView({ node, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as EmbedNodeAttrs

  return (
    <NodeViewWrapper as="div" data-node-type="embed" className="relative cursor-pointer" onClickCapture={selectNodeOnClick(editor, getPos)}>
      {attrs.url ? (
        <>
          <EmbedNode url={attrs.url} mode="edit" />
          {/* Above the iframe, below the selection ring: an iframe's own page would otherwise catch the click. */}
          <div className="absolute inset-0" />
        </>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-control border border-dashed border-border text-body text-text-subtle">
          Add an embed link
        </div>
      )}
      {selected ? <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" /> : null}
    </NodeViewWrapper>
  )
}
