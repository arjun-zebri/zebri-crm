'use client'

/**
 * Node view for the `button` node: renders the same call-to-action the
 * public page renders (via the shared `ButtonNode`, reading branding from
 * `branding-context.tsx` so a live branding edit reaches it) with a
 * selection ring around whichever control it rendered while selected. No
 * resize grip: label, action, variant, size, colour and radius are all
 * edited from the node bar (Task 11), not by dragging.
 *
 * @module features/proposals/editor/node-views/button-view
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import type { RichDocContext } from '../../render/rich-doc'
import { ButtonNode } from '../../render/rich-doc-nodes'
import type { ButtonNodeAttrs } from '../extensions/button'

import { useProposalEditorBranding } from './branding-context'
import { readEditorBranding } from './editor-storage'
import { selectNodeOnClick } from './select-node'

// A ring on the wrapper itself would outline `ButtonNode`'s full-width
// flex row (finding 9: the row is what centres/right-aligns the button
// inside it, so the wrapper must stay block-level, not shrink-wrapped);
// this rings whichever element the row actually rendered instead.
const SELECTED_RING_CLASS = '[&_a]:ring-2 [&_a]:ring-brand-fg [&_button]:ring-2 [&_button]:ring-brand-fg [&_span]:ring-2 [&_span]:ring-brand-fg'

/** Editor node view for the `button` node (registered by `extensions/button.ts` when `nodeViews` is on). */
export function ButtonView({ node, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as ButtonNodeAttrs
  // Prefer the reactive context (`branding-context.tsx`); a node view
  // rendered outside `ContentSectionEditor`'s provider (a bare test
  // harness) falls back to the storage seed.
  const branding = useProposalEditorBranding() ?? readEditorBranding(editor)
  // `onAction` is left unset: in edit mode a click selects the node
  // (below) rather than firing the accept/decline/jump behaviour it has
  // on the public page.
  const ctx: RichDocContext = { branding, mode: 'edit', values: {} }

  return (
    <NodeViewWrapper
      as="div" data-node-type="button" onClickCapture={selectNodeOnClick(editor, getPos)}
      className={`relative cursor-pointer ${selected ? SELECTED_RING_CLASS : ''}`}
    >
      <ButtonNode attrs={attrs} ctx={ctx} />
    </NodeViewWrapper>
  )
}
