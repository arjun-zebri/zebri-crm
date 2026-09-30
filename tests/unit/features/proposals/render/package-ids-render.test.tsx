/**
 * `packageIds` on a rendered packages section: a real proposal's page
 * (`packageIds="proposal"`) keeps the layout's cards but stamps the
 * proposal's own `proposal_options` ids, which is what
 * `POST /api/proposal/accept` and `finalize_proposal_acceptance` work
 * from; every template surface keeps the default and renders the card ids
 * the editor minted. On a mismatch the page falls back to the rows
 * themselves, plainer but acceptable.
 *
 * @module tests/unit/features/proposals/render/package-ids-render
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  DataSectionView, newSectionFor, ProposalLayoutView, type PackageOption, type ProposalLayout, type Section,
} from '@/features/proposals'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { PublicProposalItem, PublicProposalOption } from '@/lib/proposals/public-types'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

const ROW_A = 'cf3e94b3-5569-4a8d-92b6-b7b0bde12306'
const ROW_B = '4a6d1f02-7f1a-4a3e-9c2f-0b5d8e6a1c44'

/** Two template cards, as the editor mints them: `pk-…` ids and their own titles. */
function cards(): PackageOption[] {
  return [
    {
      id: 'pk-a', title: 'Layout card A', description: '', pricingMode: 'single', fixedPrice: 1400,
      gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
      items: [{ id: 'pi-a', description: 'Reception hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
    },
    {
      id: 'pk-b', title: 'Layout card B', description: '', pricingMode: 'single', fixedPrice: 2200,
      gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
      items: [{ id: 'pi-b', description: 'Full day hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
    },
  ]
}

/** A packages section carrying `options`, the way a saved template does. */
function packagesSection(options: PackageOption[]): Section {
  const section = newSectionFor('packages')
  const data = section.data as Extract<NonNullable<Section['data']>, { kind: 'packages' }>
  return { ...section, id: 'sec-packages', data: { kind: 'packages', packages: { ...data.packages, options } } }
}

/** One `proposal_option_items` row. */
function rowItem(id: string): PublicProposalItem {
  return { id: `${id}-item`, description: `${id} inclusion`, note: null, amount: 1400, quantity: 1, is_addon: false, default_included: true, position: 0 }
}

/** One `proposal_options` row: a real uuid and the title the DB holds. */
function row(id: string, position: number, items = [rowItem(id)]): PublicProposalOption {
  return {
    id, position, title: `Row ${position}`, description: null, pricing_mode: 'single', fixed_price: 1400,
    gst_inclusive: true, weekend_loading_percent: null, is_popular: false, subtotal: 1400, items,
  }
}

/** The sample public doc with this proposal's own option rows swapped in. */
function docWith(options: PublicProposalOption[]): PublicDocData {
  return { ...SAMPLE_PROPOSAL_DOC, proposal: { ...SAMPLE_PROPOSAL_DOC.proposal!, options } }
}

/** Every `data-option-id` on the page, de-duplicated: the carousel layout renders each card twice (desktop grid + phone stack). */
function optionIds(container: HTMLElement): string[] {
  return [...new Set([...container.querySelectorAll('[data-option-id]')].map((el) => el.getAttribute('data-option-id')!))]
}

describe('DataSectionView packageIds', () => {
  it('"proposal" stamps the proposal\'s row uuids while keeping the layout\'s cards', () => {
    const { container } = render(
      <DataSectionView
        section={packagesSection(cards())} branding={branding} doc={docWith([row(ROW_A, 0), row(ROW_B, 1)])}
        mode="page" proposal={undefined} values={{}} packageIds="proposal"
      />,
    )
    expect(optionIds(container)).toEqual([ROW_A, ROW_B])
    // The presentation is still the template's, which is the whole point
    // of substituting ids rather than rendering the rows.
    expect(container.textContent).toContain('Layout card A')
    expect(container.textContent).not.toContain('Row 0')
  })

  it('the default keeps the layout\'s own card ids, for every template surface', () => {
    const { container } = render(
      <DataSectionView
        section={packagesSection(cards())} branding={branding} doc={docWith([row(ROW_A, 0), row(ROW_B, 1)])}
        mode="page" proposal={undefined} values={{}}
      />,
    )
    expect(optionIds(container)).toEqual(['pk-a', 'pk-b'])
  })

  it('a count mismatch falls back to the rows themselves, so the couple can still accept', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <DataSectionView
        section={packagesSection(cards())} branding={branding} doc={docWith([row(ROW_A, 0)])}
        mode="page" proposal={undefined} values={{}} packageIds="proposal"
      />,
    )
    // The row's own id and the row's own plainer title, not the card's.
    expect(optionIds(container)).toEqual([ROW_A])
    expect(container.textContent).toContain('Row 0')
    expect(container.textContent).not.toContain('Layout card A')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('ProposalLayoutView threads packageIds to its packages section', () => {
  const layout: ProposalLayout = { version: 2, sections: [packagesSection(cards())] }

  it('"proposal" reaches the cards through the whole render tree', () => {
    const { container } = render(
      <ProposalLayoutView layout={layout} branding={branding} doc={docWith([row(ROW_A, 0), row(ROW_B, 1)])} mode="page" packageIds="proposal" />,
    )
    expect(optionIds(container)).toEqual([ROW_A, ROW_B])
  })

  it('omitting it leaves every card on its layout id', () => {
    const { container } = render(
      <ProposalLayoutView layout={layout} branding={branding} doc={docWith([row(ROW_A, 0), row(ROW_B, 1)])} mode="page" />,
    )
    expect(optionIds(container)).toEqual(['pk-a', 'pk-b'])
  })
})
