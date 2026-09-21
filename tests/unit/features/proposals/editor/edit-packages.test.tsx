// tests/unit/features/proposals/editor/edit-packages.test.tsx
/**
 * Packages edited in place on their cards (founder ruling 2026-09-18,
 * Qwilr-style). Two layers, like `editable-data-section.test.tsx`:
 *
 * - `packagesSlots` / `packageCardSlots` are plain functions; their
 *   fields' `onChange`/`onCommit` props are called directly to prove the
 *   `commit: false` (streamed text) vs `commit: true` (amounts, ticks,
 *   add/remove, menu) wiring and the exact `setData` payloads.
 * - The card menu, the add tile and `InlineNumber` are rendered for real.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import { describe, expect, it, vi } from 'vitest'

import {
  AddPackageTile, defaultTheme, doc, InlineField, InlineNumber, newPackageItem, newSectionFor, PackageCardMenu, packageCardSlots, packagesSlots, paragraph,
  starterPackages, text, toPublicOption, type PackageCardArgs, type PackageOption, type PackagesData, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const theme = defaultTheme(branding)

function packagesData(): PackagesData {
  return (newSectionFor('packages').data as Extract<Section['data'], { kind: 'packages' }>).packages
}

function args(overrides: Partial<PackageCardArgs> = {}): PackageCardArgs {
  const data = packagesData()
  return { sectionId: 's1', data, options: starterPackages(), dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, theme, swatches: [], ...overrides }
}

/** The `packages` payload of the last `setData` dispatch. */
function lastPackages(dispatch: ReturnType<typeof vi.fn>): PackagesData {
  const call = dispatch.mock.calls.at(-1)
  return (call?.[0] as { data: { packages: PackagesData } }).data.packages
}
function lastCommit(dispatch: ReturnType<typeof vi.fn>): boolean | undefined {
  return (dispatch.mock.calls.at(-1)?.[1] as { commit?: boolean } | undefined)?.commit
}

type FieldEl = React.ReactElement<{ onChange: (json: JSONContent) => void; placeholder?: string; value: unknown }>
function asField(node: React.ReactNode): FieldEl {
  const el = node as FieldEl
  if (el.type !== InlineField) throw new Error('not an InlineField')
  return el
}
/** Depth-first search for the first element of `type` with matching props. */
function findEl<P>(node: React.ReactNode, type: unknown, match: (props: P) => boolean): React.ReactElement<P> | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) { for (const c of node) { const f = findEl<P>(c, type, match); if (f) return f }; return null }
  const el = node as React.ReactElement<P & { children?: React.ReactNode }>
  if (el.type === type && match(el.props)) return el
  return findEl<P>(el.props?.children ?? null, type, match)
}

describe('packagesSlots', () => {
  it('builds per-card slots for the section\'s own packages (starters when it has none) and an Add package tile', () => {
    const a = args()
    const slots = packagesSlots(a)
    const [first] = starterPackages()
    const card = slots.card?.(toPublicOption(first!, 0), 0, false)
    expect(card && Object.keys(card)).toEqual(['corner', 'title', 'description', 'price', 'item', 'addon', 'footer', 'cta'])
    expect(slots.trailing).not.toBeNull()
  })

  it('a card the section does not know (a stale id) gets no slots rather than throwing', () => {
    const slots = packagesSlots(args())
    expect(slots.card?.({ ...toPublicOption(starterPackages()[0]!, 0), id: 'ghost' }, 0, false)).toEqual({})
  })

  it('at the card cap there is no add tile', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...starterPackages()[0]!, id: `p${i}` }))
    expect(packagesSlots(args({ data: { ...packagesData(), options: six } })).trailing).toBeNull()
  })

  it('Add package appends a fresh fixed-price package with commit: true and writes the starters into the layout the first time', () => {
    const a = args()
    render(<>{packagesSlots(a).trailing}</>)
    fireEvent.click(screen.getByRole('button', { name: 'Add package' }))
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    expect(lastCommit(dispatch)).toBe(true)
    const options = lastPackages(dispatch).options!
    expect(options).toHaveLength(4)
    expect(options.slice(0, 3)).toEqual(starterPackages())
    expect(options[3]).toMatchObject({ title: '', pricingMode: 'single', fixedPrice: 0 })
  })

  it('has no heading or textBelow field (2026-09-19 feedback: "remove the text from all these sections... we can always add text sections around them")', () => {
    expect(Object.keys(packagesSlots(args()))).toEqual(['card', 'trailing'])
  })
})

describe('packageCardSlots', () => {
  const first = () => starterPackages()[0]!

  it('title and description stream the live rich doc with commit: false', () => {
    const a = args()
    const slots = packageCardSlots(a, first(), 0, false)
    const titleDoc = doc(paragraph(text('Reception for '), { type: 'variable', attrs: { id: 'couple_name', fallback: 'you two' } }))
    asField(slots.title).props.onChange(titleDoc)
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    expect(lastCommit(dispatch)).toBe(false)
    expect(lastPackages(dispatch).options?.[0]?.title).toEqual(titleDoc)
    const descriptionDoc = doc(paragraph(text('Just the party.')))
    asField(slots.description).props.onChange(descriptionDoc)
    expect(lastPackages(dispatch).options?.[0]?.description).toEqual(descriptionDoc)
  })

  it('an itemised card has no price slot; a fixed-price card\'s price opens a popover and edits with commit: true', () => {
    const itemised: PackageOption = { ...first(), pricingMode: 'itemised', fixedPrice: null }
    expect(packageCardSlots(args(), itemised, 0, false).price).toBeUndefined()
    const single: PackageOption = { ...first(), pricingMode: 'single', fixedPrice: 1200 }
    const a = args({ options: [single] })
    const slots = packageCardSlots(a, single, 0, false)
    render(<>{slots.price}</>)
    fireEvent.click(screen.getByRole('button', { name: '$1,200.00' }))
    const input = screen.getByRole('textbox', { name: /Price for/ })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1500' } })
    fireEvent.blur(input)
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    expect(lastCommit(dispatch)).toBe(true)
    expect(lastPackages(dispatch).options?.[0]?.fixedPrice).toBe(1500)
  })

  it('an inclusion row edits its description (streamed) and amount (committed), and removes itself', () => {
    const a = args()
    const extra = { ...newPackageItem(), id: 'pi-extra', description: 'Extra thing' }
    const option: PackageOption = { ...first(), pricingMode: 'itemised', items: [...first().items, extra] }
    const slots = packageCardSlots(a, option, 0, false)
    const pub = toPublicOption(option, 0)
    const row = slots.item!(pub.items[0]!, 0)
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    const runSheetDoc = doc(paragraph(text('Run sheet')))
    findEl<{ onChange: (j: JSONContent) => void; placeholder?: string }>(row, InlineField, (p) => p.placeholder === 'Inclusion')!.props.onChange(runSheetDoc)
    expect(lastCommit(dispatch)).toBe(false)
    expect(lastPackages(dispatch).options?.[0]?.items[0]?.description).toEqual(runSheetDoc)
    findEl<{ onCommit: (v: number) => void }>(row, InlineNumber, () => true)!.props.onCommit(300)
    expect(lastCommit(dispatch)).toBe(true)
    expect(lastPackages(dispatch).options?.[0]?.items[0]?.amount).toBe(300)
    render(<ul><li>{row}</li></ul>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove inclusion Reception hosting (5 hours)' }))
    expect(lastPackages(dispatch).options?.[0]?.items.map((i) => i.id)).toEqual(['pi-extra'])
  })

  it('an add-on row\'s checkbox sets whether it is ticked by default', () => {
    const a = args()
    const addon = { ...newPackageItem(true), id: 'pi-addon', description: 'Extra hour' }
    const option: PackageOption = { ...first(), items: [...first().items, addon] }
    const pub = toPublicOption(option, 0)
    const row = packageCardSlots(a, option, 0, false).addon!(pub.items[1]!, 1)
    render(<ul><li>{row}</li></ul>)
    const box = screen.getByRole('checkbox', { name: 'Ticked by default: Extra hour' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    expect(lastCommit(dispatch)).toBe(true)
    expect(lastPackages(dispatch).options?.[0]?.items[1]?.defaultIncluded).toBe(true)
  })

  it('Add inclusion / Add add-on append a blank line of the right kind', () => {
    const a = args()
    render(<>{packageCardSlots(a, first(), 0, false).footer}</>)
    fireEvent.click(screen.getByRole('button', { name: 'Add add-on' }))
    const dispatch = a.dispatch as ReturnType<typeof vi.fn>
    const items = lastPackages(dispatch).options?.[0]?.items ?? []
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({ description: '', isAddon: true })
  })
})

describe('PackageCardMenu', () => {
  function openMenu(a = args(), index = 0) {
    render(<PackageCardMenu args={a} option={a.options[index]!} index={index} />)
    fireEvent.click(screen.getByRole('button', { name: /^Edit package/ }))
    return a.dispatch as ReturnType<typeof vi.fn>
  }

  it('opening the menu selects the section', () => {
    const a = args()
    openMenu(a)
    expect(a.onFocus).toHaveBeenCalledTimes(1)
  })

  it('Recommended marks this card and clears every other', () => {
    const dispatch = openMenu()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recommended' }))
    expect(lastCommit(dispatch)).toBe(true)
    expect(lastPackages(dispatch).options?.map((o) => o.isPopular)).toEqual([true, false, false])
  })

  it('Fixed price switches the pricing mode; Price incl. GST toggles gstInclusive', () => {
    const dispatch = openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Fixed price' }))
    expect(lastPackages(dispatch).options?.[0]?.pricingMode).toBe('single')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Price incl. GST' }))
    expect(lastPackages(dispatch).options?.[0]?.gstInclusive).toBe(false)
  })

  it('Move left is disabled on the first card; Move right reorders', () => {
    const dispatch = openMenu()
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move right' }))
    expect(lastPackages(dispatch).options?.map((o) => o.id)).toEqual(['pk-starter-2', 'pk-starter-1', 'pk-starter-3'])
  })

  it('Remove package drops the card', () => {
    const dispatch = openMenu(args(), 1)
    fireEvent.click(screen.getByRole('button', { name: 'Remove package' }))
    expect(lastPackages(dispatch).options?.map((o) => o.id)).toEqual(['pk-starter-1', 'pk-starter-3'])
  })
})

describe('AddPackageTile', () => {
  it('explains the hidden-while-empty rule only when the section has no packages', () => {
    const { rerender } = render(<AddPackageTile empty={false} onAdd={vi.fn()} />)
    expect(screen.queryByText(/hidden on the sent proposal/)).toBeNull()
    rerender(<AddPackageTile empty onAdd={vi.fn()} />)
    expect(screen.getByText(/hidden on the sent proposal/)).toBeInTheDocument()
  })
})

describe('InlineNumber', () => {
  it('rests on the sent card\'s format, edits as bare digits, and commits the parsed value once on blur or Enter', () => {
    const onCommit = vi.fn()
    render(<InlineNumber value={1650} label="Price" max={10000} onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Price' })
    expect(input).toHaveValue('1,650.00')
    fireEvent.focus(input)
    expect(input).toHaveValue('1650')
    fireEvent.change(input, { target: { value: '$1,999.5' } })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(1999.5)
  })

  it('an unusable entry reverts without committing; a value over max is clamped; an unchanged value does not commit', () => {
    const onCommit = vi.fn()
    render(<InlineNumber value={250} label="Amount" max={1000} onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Amount' })
    fireEvent.focus(input); fireEvent.change(input, { target: { value: 'abc' } }); fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('250.00')
    fireEvent.focus(input); fireEvent.change(input, { target: { value: '5000' } }); fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith(1000)
    fireEvent.focus(input); fireEvent.change(input, { target: { value: '250' } }); fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('in whole mode: rests without cents, refuses a typed decimal point, and rounds a pasted decimal on commit', () => {
    const onCommit = vi.fn()
    render(<InlineNumber value={1650} label="Amount" max={10000} decimals="whole" onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Amount' })
    expect(input).toHaveValue('1,650')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    fireEvent.focus(input)
    // The "." keystroke is refused (fireEvent returns false when the default was prevented); a digit is not.
    expect(fireEvent.keyDown(input, { key: '.' })).toBe(false)
    expect(fireEvent.keyDown(input, { key: '9' })).toBe(true)
    // A pasted "$1,999.5" lands intact and rounds on commit.
    fireEvent.change(input, { target: { value: '$1,999.5' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith(2000)
  })

  it('in whole mode: a stored cents value rests rounded and edits as the rounded integer', () => {
    render(<InlineNumber value={149.5} label="Amount" max={10000} decimals="whole" onCommit={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Amount' })
    expect(input).toHaveValue('150')
    fireEvent.focus(input)
    expect(input).toHaveValue('150')
  })

  it('Escape reverts the buffer', () => {
    const onCommit = vi.fn()
    render(<InlineNumber value={40} label="Amount" max={1000} onCommit={onCommit} />)
    const input = screen.getByRole('textbox', { name: 'Amount' })
    fireEvent.focus(input); fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Escape' }); fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
