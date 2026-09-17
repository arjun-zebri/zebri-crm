'use client'

/**
 * The `columns` node's control bar (Proposal Layout v2 Phase 2, spec
 * §4): a 2/3 `PillToggle` (`setColumnCount`, `extensions/columns.ts`)
 * and Reset ratio (`resetColumnRatios`). No Remove: unlike image, embed
 * and audio, the brief lists none for this row, and ProseMirror's own
 * default keymap already deletes a selected atom/container node on
 * Backspace, which is what `node-bar.tsx`'s `useNodeAttrs` returning
 * `undefined` afterwards is for.
 *
 * @module features/proposals/editor/bars/node-bar-columns
 */
import type { Editor } from '@tiptap/react'
import { RotateCcw } from 'lucide-react'

import { PillToggle } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import type { ColumnsNodeAttrs } from '../extensions/columns'
import type { NodeSelection } from '../state'

import { useNodeAttrs } from './node-bar-shared'

/** Props for {@link NodeBarColumns}. */
export interface NodeBarColumnsProps {
  node: NonNullable<NodeSelection>
  editor: Editor
}

/** The `columns` node's control bar. */
export function NodeBarColumns({ node, editor }: NodeBarColumnsProps) {
  const attrs = useNodeAttrs<ColumnsNodeAttrs>(editor, node.pos, 'columns')
  if (!attrs) return null

  return (
    <>
      <PillToggle<'2' | '3'>
        value={attrs.count === 3 ? '3' : '2'}
        onChange={(v) => editor.commands.setColumnCount(v === '3' ? 3 : 2, node.pos)}
        options={[
          { value: '2', label: '2' },
          { value: '3', label: '3' },
        ]}
      />
      <Tooltip label="Reset ratio">
        <Button variant="ghost" iconOnly aria-label="Reset ratio" onClick={() => editor.commands.resetColumnRatios(node.pos)}>
          <RotateCcw size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
