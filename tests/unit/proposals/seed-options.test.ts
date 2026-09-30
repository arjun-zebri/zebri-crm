/**
 * `features/proposals/model/seed-options`: reading a template layout's
 * package cards and mapping them to the option-input shape a new proposal
 * is seeded with (roadmap R3 §6.1, "Create").
 *
 * @module tests/unit/proposals/seed-options
 */
import { describe, expect, it } from 'vitest'

import {
  doc, layoutPackageOptions, packageOptionsToInputs, paragraph, starterPackages, text,
  type PackageOption, type ProposalLayout, type Section,
} from '@/features/proposals'

/** A packages section carrying exactly `options`, with the minimum a `Section` needs. */
function packagesSection(options: PackageOption[] | undefined, id = 'sec-packages'): Section {
  return {
    id,
    kind: 'packages',
    style: { height: 'fit' },
    data: { kind: 'packages', packages: { layout: 'cards', showInclusions: true, ctaLabel: 'Choose this', ...(options ? { options } : {}) } },
  }
}

/** A layout wrapping `sections`. */
function layout(sections: Section[]): ProposalLayout {
  return { version: 2, sections }
}

/** One fully specified card, so each assertion can override just the field it is about. */
function card(overrides: Partial<PackageOption> = {}): PackageOption {
  return {
    id: 'pk-1',
    title: 'Reception MC',
    description: 'Five hours of hosting',
    pricingMode: 'single',
    fixedPrice: 1400,
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: false,
    items: [{ id: 'pi-1', description: 'Reception hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
    ...overrides,
  }
}

describe('layoutPackageOptions', () => {
  it('returns the cards of the first packages section', () => {
    const first = card({ id: 'pk-first', title: 'First' })
    const second = card({ id: 'pk-second', title: 'Second' })
    const result = layoutPackageOptions(layout([
      { id: 'sec-content', kind: 'content', style: { height: 'fit' }, content: doc(paragraph(text('hello'))) },
      packagesSection([first], 'sec-a'),
      packagesSection([second], 'sec-b'),
    ]))
    expect(result).toEqual([first])
  })

  it('returns [] for a layout with no packages section', () => {
    expect(layoutPackageOptions(layout([{ id: 'sec-content', kind: 'content', style: { height: 'fit' } }]))).toEqual([])
  })

  it('falls back to the starter cards for a section saved before packages lived in the block', () => {
    // `resolvePackageOptions` is what every other surface renders for such
    // a section, so the seed must agree with what the MC was shown.
    expect(layoutPackageOptions(layout([packagesSection(undefined)]))).toEqual(starterPackages())
  })
})

describe('packageOptionsToInputs', () => {
  it('carries pricing, flags and items across, numbering both from 1', () => {
    const [option] = packageOptionsToInputs([card({
      pricingMode: 'itemised',
      fixedPrice: null,
      gstInclusive: false,
      weekendLoadingPercent: 15,
      isPopular: true,
      items: [
        { id: 'pi-1', description: 'Hosting', amount: 1400, quantity: 1, isAddon: false, defaultIncluded: true },
        { id: 'pi-2', description: 'Ceremony', amount: 400, quantity: 2, isAddon: true, defaultIncluded: false },
      ],
    })])
    expect(option).toBeDefined()
    expect(option).toMatchObject({
      position: 1,
      title: 'Reception MC',
      description: 'Five hours of hosting',
      sourcePackageId: null,
      pricingMode: 'itemised',
      fixedPrice: null,
      gstInclusive: false,
      weekendLoadingPercent: 15,
      isPopular: true,
    })
    expect(option?.items).toMatchObject([
      { description: 'Hosting', amount: 1400, quantity: 1, isAddon: false, defaultIncluded: true, note: null, position: 1 },
      { description: 'Ceremony', amount: 400, quantity: 2, isAddon: true, defaultIncluded: false, note: null, position: 2 },
    ])
  })

  it('numbers options from 1 in array order', () => {
    const inputs = packageOptionsToInputs([card({ id: 'pk-1' }), card({ id: 'pk-2' }), card({ id: 'pk-3' })])
    expect(inputs.map((o) => o.position)).toEqual([1, 2, 3])
  })

  it('flattens rich text to plain strings', () => {
    const [option] = packageOptionsToInputs([card({
      title: doc(paragraph(text('Full '), text('day'))),
      description: doc(paragraph(text('Ceremony to last dance'))),
      items: [{ id: 'pi-1', description: doc(paragraph(text('Rehearsal'))), amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
    })])
    expect(option?.title).toBe('Full day')
    expect(option?.description).toBe('Ceremony to last dance')
    expect(option?.items[0]?.description).toBe('Rehearsal')
  })

  it('stands an empty title in as "Untitled option" and an empty description as null', () => {
    const [option] = packageOptionsToInputs([card({ title: '', description: '' })])
    expect(option?.title).toBe('Untitled option')
    expect(option?.description).toBeNull()
  })

  it('mints a new- id for a package id that is not a uuid, and keeps one that is', () => {
    const uuid = '3f1b7d9c-2a4e-4f18-9c3d-1a2b3c4d5e6f'
    const [minted, kept] = packageOptionsToInputs([
      card({ id: 'pk-1', items: [{ id: 'pi-1', description: 'Hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }] }),
      card({ id: uuid, items: [{ id: uuid, description: 'Hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }] }),
    ])
    // The write path reads a `new-` prefix as "insert me"; a `pk-…` id is
    // not a uuid and would fail the column's type outright.
    expect(minted?.id).toMatch(/^new-/)
    expect(minted?.items[0]?.id).toMatch(/^new-/)
    expect(kept?.id).toBe(uuid)
    expect(kept?.items[0]?.id).toBe(uuid)
  })

  it('maps an empty list to an empty list', () => {
    expect(packageOptionsToInputs([])).toEqual([])
  })
})
