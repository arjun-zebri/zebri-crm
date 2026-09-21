/**
 * The public renderer's `<table>` for a `table` node: a scrolling wrapper
 * (a table sized wider than a phone scrolls inside its own box rather than
 * pushing the whole page sideways), a `<colgroup>` carrying each column's
 * `colwidth`, the width / min-width / height `tableLayout` derives, and
 * the node's `borderColor` as `--table-border` for the cells to read.
 * Rows and cells are rendered by `rich-doc.tsx`'s `renderBlock` and passed
 * in as `children`, so this file owns only the structure prosemirror-tables'
 * own `TableView` builds in the editor (`div.tableWrapper > table >
 * colgroup + tbody`).
 *
 * @module features/proposals/render/table-node
 */
import type { JSONContent } from '@tiptap/core'
import type { CSSProperties, ReactNode } from 'react'

import { tableLayout } from './table-layout'

/** Props for {@link TableNode}. */
export interface TableNodeProps {
  /** The `table` node's JSON (its attrs and first row drive the sizing). */
  node: JSONContent
  /** The already-rendered `<tr>` rows. */
  children: ReactNode
}

/**
 * See the module doc. On a phone-width host a fully sized table drops to
 * that width with each column at its percentage share (`--col-pct`, from
 * `tableLayout`'s `percents`), the same rule the editor applies
 * (`editor-styles.ts`). Keyed off the `@container/doc` every host wraps
 * the render in, not the viewport, for the reason `section.tsx` gives:
 * the editor's mobile canvas and mobile Preview are a ~390px column inside
 * a desktop window. `!` because the px width is an inline style, which
 * nothing but an `!important` rule can beat. A not-fully-sized table also
 * carries an inline `minWidth` (its desktop px sum, from `tableLayout`);
 * `min-w-0` resets that too, because CSS resolves `min-width` before
 * `width` regardless of specificity (`used width = max(min-width,
 * min(width, max-width))`) - live-found 2026-09-19: `!w-full` alone still
 * left the table pinned to its desktop min-width on a phone.
 */
export function TableNode({ node, children }: TableNodeProps) {
  const { columns, percents, style } = tableLayout(node)
  const borderColor = typeof node.attrs?.borderColor === 'string' ? node.attrs.borderColor : null
  const tableStyle = borderColor ? ({ ...style, '--table-border': borderColor } as CSSProperties) : style
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full table-fixed border-collapse @max-3xl/doc:!w-full @max-3xl/doc:!min-w-0" style={tableStyle}>
        <colgroup>
          {columns.map((w, i) => {
            const pct = percents[i]
            return (
              <col
                key={i}
                className={pct === null ? undefined : '@max-3xl/doc:![width:var(--col-pct)]'}
                style={w === null ? undefined : pct === null ? { width: w } : ({ width: w, '--col-pct': `${pct}%` } as CSSProperties)}
              />
            )
          })}
        </colgroup>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
