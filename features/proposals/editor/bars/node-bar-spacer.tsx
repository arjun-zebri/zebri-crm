'use client'

/**
 * The `spacer` node's control bar (Proposal Layout v2 Phase 2, spec §4):
 * one `NumberStepper` for its height. No Remove, matching `columns`
 * (see that file's module doc for why).
 *
 * @module features/proposals/editor/bars/node-bar-spacer
 */
import type { Editor } from '@tiptap/react'

import { NumberStepper } from '@/components/editor'

import type { SpacerNodeAttrs } from '../extensions/spacer'
import type { NodeSelection } from '../state'

import { useNodeAttrs, writeNodeAttrs } from './node-bar-shared'

/** Props for {@link NodeBarSpacer}. */
export interface NodeBarSpacerProps {
  node: NonNullable<NodeSelection>
  editor: Editor
}

/** The `spacer` node's control bar. */
export function NodeBarSpacer({ node, editor }: NodeBarSpacerProps) {
  const attrs = useNodeAttrs<SpacerNodeAttrs>(editor, node.pos, 'spacer')
  if (!attrs) return null

  return (
    <NumberStepper
      value={attrs.heightPx}
      min={8}
      max={160}
      step={8}
      suffix="px"
      ariaLabel="Height"
      onChange={(heightPx) => writeNodeAttrs(editor, node.pos, { heightPx })}
    />
  )
}
