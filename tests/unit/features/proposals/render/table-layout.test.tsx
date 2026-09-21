/**
 * `tableLayout` must match prosemirror-tables' `updateColumns` exactly, so
 * the public page sizes a table the way the editor drew it: a sized
 * column is its `colwidth`, an unsized one counts as `TABLE_CELL_MIN_WIDTH`
 * in the sum, a fully sized table is rendered at that sum and a partly
 * sized one stays fluid with the sum as its minimum.
 *
 * @module tests/unit/features/proposals/render/table-layout
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { paragraph, TABLE_CELL_MIN_WIDTH, tableColumnWidths, tableLayout, TableNode, text } from '@/features/proposals'

const cell = (attrs?: Record<string, unknown>) => ({ type: 'tableCell', ...(attrs ? { attrs } : {}), content: [paragraph(text('c'))] })
const table = (cells: ReturnType<typeof cell>[], attrs?: Record<string, unknown>) =>
  ({ type: 'table', ...(attrs ? { attrs } : {}), content: [{ type: 'tableRow', content: cells }, { type: 'tableRow', content: cells.map(() => cell()) }] })

describe('tableLayout', () => {
  it('a table with no widths is fluid: no width, min-width of cols × cell minimum', () => {
    const { columns, style } = tableLayout(table([cell(), cell(), cell()]))
    expect(columns).toEqual([null, null, null])
    expect(style).toEqual({ minWidth: 3 * TABLE_CELL_MIN_WIDTH })
  })

  it('a fully sized table is exactly the sum of its columns (the width grip writes every colwidth), with percentage shares for phones', () => {
    const { columns, percents, style } = tableLayout(table([cell({ colwidth: [120] }), cell({ colwidth: [200] })]))
    expect(columns).toEqual([120, 200])
    expect(percents).toEqual([37.5, 62.5])
    expect(style).toEqual({ width: 320 })
  })

  it('a partly sized table (one column dragged) stays fluid with the sum as its minimum, but still gets phone percentages (live bug 2026-09-19: a dragged column\'s absolute px otherwise ignored the phone width entirely, crushing the other columns to near nothing)', () => {
    const { columns, percents, style } = tableLayout(table([cell({ colwidth: [150] }), cell()]))
    expect(columns).toEqual([150, null])
    const total = 150 + TABLE_CELL_MIN_WIDTH
    expect(percents).toEqual([(150 / total) * 100, (TABLE_CELL_MIN_WIDTH / total) * 100])
    expect(style).toEqual({ minWidth: total })
  })

  it('a table with no widths at all skips percentages: the browser\'s own equal-column default for an all-auto table already works on a phone', () => {
    const { percents } = tableLayout(table([cell(), cell(), cell()]))
    expect(percents).toEqual([null, null, null])
  })

  it('a spanning cell contributes one column per span, and malformed widths read as unsized', () => {
    expect(tableColumnWidths(table([cell({ colspan: 2, colwidth: [100, 'x'] }), cell({ colwidth: [-5] })]))).toEqual([100, null, null])
  })

  it('carries the table height, ignoring a non-positive one', () => {
    expect(tableLayout(table([cell()], { height: 240 })).style.height).toBe(240)
    expect(tableLayout(table([cell()], { height: 0 })).style.height).toBeUndefined()
  })

  it('TableNode renders the colgroup and the inline size', () => {
    const node = table([cell({ colwidth: [120] }), cell({ colwidth: [200] })], { height: 300 })
    const { container } = render(<TableNode node={node}><tr><td>x</td></tr></TableNode>)
    const cols = container.querySelectorAll('col')
    expect(cols).toHaveLength(2)
    expect(cols[1]?.getAttribute('style')).toContain('width: 200px')
    expect(cols[1]?.getAttribute('style')).toContain('--col-pct: 62.5%')
    expect(cols[1]?.className).toContain('@max-3xl/doc:')
    expect(container.querySelector('table')?.getAttribute('style')).toContain('width: 320px')
    expect(container.querySelector('table')?.getAttribute('style')).toContain('height: 300px')
  })

  it('a not-fully-sized table resets its own min-width on a phone (live bug 2026-09-19: `min-width` always wins over `width: 100%` regardless of specificity, so the desktop px sum kept the whole table wider than the phone no matter how the columns themselves were sized)', () => {
    const node = table([cell({ colwidth: [150] }), cell()])
    const { container } = render(<TableNode node={node}><tr><td>x</td></tr></TableNode>)
    const el = container.querySelector('table')!
    expect(el.getAttribute('style')).toContain(`min-width: ${150 + TABLE_CELL_MIN_WIDTH}px`)
    expect(el.className).toContain('@max-3xl/doc:!min-w-0')
  })
})
