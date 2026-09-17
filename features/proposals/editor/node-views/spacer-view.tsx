'use client'

/**
 * Node view for the `spacer` node: renders the same fixed-height gap the
 * public page renders (via the shared `SpacerBox`) and, while selected, a
 * bottom-edge grip that resizes `heightPx` in 8px steps.
 *
 * @module features/proposals/editor/node-views/spacer-view
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { ResizeGrip } from '@/components/editor'

import { SpacerBox } from '../../render/rich-doc-nodes'
import type { SpacerNodeAttrs } from '../extensions/spacer'

import { NodeGrips } from './node-grips'
import { selectNodeOnClick } from './select-node'

/** `heightPx` bounds and step (spec: a Canva-style grip, not a free drag). */
const MIN_HEIGHT_PX = 8
const MAX_HEIGHT_PX = 160
const STEP_PX = 8

/** Editor node view for the `spacer` node (registered by `extensions/spacer.ts` when `nodeViews` is on). */
export function SpacerView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as SpacerNodeAttrs

  return (
    <NodeViewWrapper
      as="div" data-node-type="spacer" className="relative cursor-pointer"
      onClickCapture={selectNodeOnClick(editor, getPos)}
    >
      <SpacerBox heightPx={attrs.heightPx} mode="edit" />
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" />
          <NodeGrips>
            <ResizeGrip
              axis="y" value={attrs.heightPx} min={MIN_HEIGHT_PX} max={MAX_HEIGHT_PX} step={STEP_PX}
              format={(v) => `${v}px`} onChange={(heightPx) => updateAttributes({ heightPx })}
              ariaLabel="Spacer height"
            />
          </NodeGrips>
        </>
      ) : null}
    </NodeViewWrapper>
  )
}
