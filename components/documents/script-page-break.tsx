'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

/**
 * Editor-only NodeView for the script page-break block: a dashed rule with a
 * label so the writer can see where the printed page ends. Selecting it (or
 * pressing Backspace over it) removes it like any atom. The print output never
 * shows this chrome: the node serialises to `<hr data-page-break>` and the
 * print CSS turns that into a real page break.
 */
export function ScriptPageBreakView({ selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      data-page-break=""
      data-drag-handle
      contentEditable={false}
      className={`my-4 flex select-none items-center gap-3 rounded-control px-1 py-1 text-body text-text-subtle ${
        selected ? 'bg-surface-emphasis' : ''
      }`}
    >
      <span className="h-px flex-1 border-t border-dashed border-border-strong" />
      <span>Page break</span>
      <span className="h-px flex-1 border-t border-dashed border-border-strong" />
    </NodeViewWrapper>
  )
}
