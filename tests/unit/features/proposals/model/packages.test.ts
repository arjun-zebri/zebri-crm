// tests/unit/features/proposals/model/packages.test.ts
/**
 * `model/packages.ts` (founder ruling 2026-09-18: a template's packages
 * section owns its packages): the starters, the public-shape adapter
 * with its derived subtotal, the fallback for a template that predates
 * `options`, and the typed schema on `data.packages.options`.
 */
import { describe, expect, it } from 'vitest'

import {
  doc, newPackageItem, newPackageOption, newSectionFor, PACKAGE_LIMITS, paragraph, parseProposalLayout, resolvePackageOptions,
  starterPackages, text, toPublicOption, type PackageOption, type ProposalLayout, type Section,
} from '@/features/proposals'

function packagesSection(options: PackageOption[] | undefined): Section {
  const section = newSectionFor('packages')
  if (section.data?.kind !== 'packages') throw new Error('not packages')
  const base = section.data.packages
  const rest = Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'options')) as typeof base
  return { ...section, data: { kind: 'packages', packages: options === undefined ? rest : { ...rest, options } } }
}
function layout(sections: Section[]): ProposalLayout {
  return { version: 2, sections }
}

describe('starterPackages / resolvePackageOptions', () => {
  it('starters are deterministic (same ids on every call) and exactly one is popular', () => {
    expect(starterPackages()).toEqual(starterPackages())
    expect(starterPackages().filter((p) => p.isPopular)).toHaveLength(1)
  })

  it('a section with no options resolves to the starters; one with options keeps them, even empty', () => {
    expect(resolvePackageOptions({})).toEqual(starterPackages())
    expect(resolvePackageOptions({ options: [] })).toEqual([])
    const own = [newPackageOption()]
    expect(resolvePackageOptions({ options: own })).toBe(own)
  })

  it('a fresh package is fixed-price with one blank inclusion; a fresh add-on is unticked', () => {
    const option = newPackageOption()
    expect(option.pricingMode).toBe('single')
    expect(option.fixedPrice).toBe(0)
    expect(option.items).toHaveLength(1)
    expect(option.items[0]?.isAddon).toBe(false)
    expect(newPackageItem(true)).toMatchObject({ isAddon: true, defaultIncluded: false, amount: 0, quantity: 1 })
  })
})

describe('toPublicOption', () => {
  it('maps to the snake_case public shape with the subtotal derived from the fixed price', () => {
    const [first] = starterPackages()
    const pub = toPublicOption(first!, 3)
    expect(pub).toMatchObject({ id: 'pk-starter-1', position: 3, title: 'Reception MC', pricing_mode: 'single', is_popular: false, subtotal: 1400 })
    expect(pub.items.map((i) => [i.id, i.is_addon, i.default_included, i.position])).toEqual([['pi-starter-1', false, true, 0]])
  })

  it('a fixed-price package reports its fixed price as the subtotal and an empty description as null', () => {
    const option: PackageOption = { ...newPackageOption(), pricingMode: 'single', fixedPrice: 999, description: '' }
    const pub = toPublicOption(option, 0)
    expect(pub.subtotal).toBe(999)
    expect(pub.fixed_price).toBe(999)
    expect(pub.description).toBeNull()
  })

  it('flattens a rich title/description to plain text, keeping a variable chip as its template token', () => {
    const option: PackageOption = {
      ...newPackageOption(),
      title: doc(paragraph(text('Reception for '), { type: 'variable', attrs: { id: 'couple_name', fallback: 'you two' } })),
      description: doc(paragraph(text('Just the party.'))),
    }
    const pub = toPublicOption(option, 0)
    expect(pub.title).toBe('Reception for {{couple_name | you two}}')
    expect(pub.description).toBe('Just the party.')
  })
})

describe('parseProposalLayout: data.packages.options', () => {
  it('accepts a section with no options (legacy), an empty list, and the starters', () => {
    expect(parseProposalLayout(layout([packagesSection(undefined)])).ok).toBe(true)
    expect(parseProposalLayout(layout([packagesSection([])])).ok).toBe(true)
    expect(parseProposalLayout(layout([packagesSection(starterPackages())])).ok).toBe(true)
  })

  it('rejects more than the card cap, a negative amount, and an unknown pricing mode', () => {
    const tooMany = Array.from({ length: PACKAGE_LIMITS.maxOptions + 1 }, () => newPackageOption())
    expect(parseProposalLayout(layout([packagesSection(tooMany)])).ok).toBe(false)
    const negative: PackageOption = { ...newPackageOption(), items: [{ ...newPackageItem(), amount: -1 }] }
    expect(parseProposalLayout(layout([packagesSection([negative])])).ok).toBe(false)
    const badMode = { ...newPackageOption(), pricingMode: 'hourly' } as unknown as PackageOption
    expect(parseProposalLayout(layout([packagesSection([badMode])])).ok).toBe(false)
  })

  it('keeps the other packages fields (heading, layout, ctaLabel) alongside typed options', () => {
    const result = parseProposalLayout(layout([packagesSection(starterPackages())]))
    if (!result.ok) throw new Error('expected ok')
    const data = result.layout.sections[0]?.data
    expect(data?.kind === 'packages' && data.packages.ctaLabel).toBe('Choose this package')
  })

  it('accepts a rich-text title/description/item, and a legacy plain-string one (no migration needed)', () => {
    const rich: PackageOption = {
      ...newPackageOption(),
      title: doc(paragraph(text('Bold title'))),
      description: doc(paragraph(text('Rich description'))),
      items: [{ ...newPackageItem(), description: doc(paragraph(text('Rich inclusion'))) }],
    }
    expect(parseProposalLayout(layout([packagesSection([rich])])).ok).toBe(true)
    const legacy: PackageOption = { ...newPackageOption(), title: 'Plain title', description: 'Plain description' }
    expect(parseProposalLayout(layout([packagesSection([legacy])])).ok).toBe(true)
  })
})
