'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { getVariable } from '@/lib/branding/document-variables'
import { HintBubble } from '@/lib/branding/public-blocks/hint-bubble'

/**
 * Editor-only React NodeView for a variable chip. Renders `{{ label }}` in mint
 * green so the MC can see it is a variable, matching the email/contract template
 * chips. This chrome never reaches the sent document: on the public surface the
 * plain node serializes to `<span data-variable="id">` and is replaced by the
 * resolved value. The chip carries `data-drag-handle` so it can be moved, and is
 * atomic (selected/deleted as one unit) per the node config.
 *
 * The chip reflects marks applied to it (bold / colour / size) because the
 * wrapper inherits the surrounding text style, giving live feedback on how the
 * resolved value will look.
 */
export function VariableChip({ node, selected }: NodeViewProps) {
  const id = (node.attrs as { id?: string }).id ?? ''
  const variable = getVariable(id)
  const label = variable?.label ?? id
  // Hover tooltip explains how the value gets filled; the help cursor signals it.
  const hint = variable ? variable.source : 'Auto-filled when the document is sent.'

  return (
    <NodeViewWrapper
      as="span"
      data-variable={id}
      className={`relative group/vh inline-flex items-center rounded-control px-1 py-px mx-px align-baseline text-[0.95em] font-medium cursor-help transition ${
        selected ? 'ring-2 ring-emerald-400' : ''
      }`}
      style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
      contentEditable={false}
      draggable
    >
      {`{{ ${label} }}`}
      <HintBubble hint={hint} />
    </NodeViewWrapper>
  )
}
