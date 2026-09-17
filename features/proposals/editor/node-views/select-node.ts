/**
 * Shared click handler for every atom/container node view: turns a click
 * anywhere in the node view's chrome into a TipTap `NodeSelection` on that
 * node.
 *
 * @module features/proposals/editor/node-views/select-node
 */
import type { Editor } from '@tiptap/react'
import type { MouseEvent } from 'react'

/**
 * Builds an `onClickCapture` handler that selects the node at `getPos()`.
 * Runs in the capture phase and calls `preventDefault` first, so a link
 * button's anchor never navigates and an embed's iframe never grabs the
 * click; `stopPropagation` keeps the click from reaching the section
 * canvas below the editor, which would otherwise read it as "select this
 * section" instead of "select this node".
 *
 * A click that lands on actual editable text/inline content inside the
 * node's own content DOM (`[data-node-view-content]`, the `columns`
 * view's `NodeViewContent`; every atom view has none, so this never
 * matches for them) is left alone entirely, so placing a caret inside a
 * column's paragraph never gets hijacked into selecting the whole row.
 * A click that only reaches the content wrapper itself (the gutter gap
 * between columns, where the target *is* `[data-node-view-content]`) or
 * a column's own empty space (`[data-node="column"]`, its whole box, not
 * just the text inside it) still selects the row: without that
 * distinction the row could never be selected with the mouse at all,
 * since its content fills essentially the whole node view.
 */
export function selectNodeOnClick(editor: Editor, getPos: () => number | undefined) {
  return (e: MouseEvent<HTMLElement>) => {
    const content = e.currentTarget.querySelector('[data-node-view-content]')
    const target = e.target
    const onColumnBox = target instanceof Element && target.matches('[data-node="column"]')
    const inEditableText = !!content && target !== content && !onColumnBox && content.contains(target as Node)
    if (inEditableText) return
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos()
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos)
  }
}
