import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import type { PackagesBlock } from '@/app/(dashboard)/branding/blocks/types'
import { priced } from '@/lib/branding/public-blocks/proposal/package-card'
import { resolveSelection, RenderPackages } from '@/lib/branding/public-blocks/proposal/packages'
import { fmt } from '@/lib/branding/public-blocks/shared'
import type { PublicDocProposal, ProposalSlotProps } from '@/lib/branding/public-blocks/shared'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { optionTotal } from '@/lib/proposals/pricing'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({})
const block = blockTemplate('packages') as PackagesBlock
const doc = SAMPLE_PROPOSAL_DOC
const proposal = doc.proposal!
const [optionA, optionB] = proposal.options // opt-1 "Reception MC" (not popular), opt-2 "Full day" (popular)

function totalFor(optionId: string, addonIds: readonly string[]): string {
  const option = proposal.options.find((o) => o.id === optionId)!
  return fmt(optionTotal(priced(option), addonIds))
}

describe('resolveSelection', () => {
  it('defaults to the popular option with its default-included add-ons', () => {
    expect(resolveSelection(proposal, undefined)).toEqual({ optionId: optionB?.id, addonIds: ['i-7'] })
  })

  it('falls back to the first option when none is popular', () => {
    const noPopular: PublicDocProposal = { ...proposal, options: proposal.options.map((o) => ({ ...o, is_popular: false })) }
    expect(resolveSelection(noPopular, undefined).optionId).toBe(optionA?.id)
  })

  it('an accepted snapshot beats the popular default', () => {
    const accepted: PublicDocProposal = { ...proposal, acceptedOptionId: optionA!.id, acceptedAddonIds: ['i-3'] }
    expect(resolveSelection(accepted, undefined)).toEqual({ optionId: optionA?.id, addonIds: ['i-3'] })
  })

  it('an explicit slot selection beats an accepted snapshot', () => {
    const accepted: PublicDocProposal = { ...proposal, acceptedOptionId: optionA!.id, acceptedAddonIds: ['i-3'] }
    const slot: ProposalSlotProps = { selectedOptionId: optionB!.id, selectedAddonIds: ['i-8'] }
    expect(resolveSelection(accepted, slot)).toEqual({ optionId: optionB?.id, addonIds: ['i-8'] })
  })
})

describe('RenderPackages', () => {
  it('renders null when there is no proposal and no slot', () => {
    const { container } = render(
      <RenderPackages block={block} branding={branding} doc={{ title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders one article per option with the title as an h3 and a popular pill', () => {
    render(<RenderPackages block={block} branding={branding} doc={doc} />)
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(2)
    expect(within(articles[1] as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent('Full day')
    expect(within(articles[1] as HTMLElement).getByText('Most popular')).toBeInTheDocument()
    expect(within(articles[0] as HTMLElement).queryByText('Most popular')).toBeNull()
  })

  it('defaults to the popular option selected, with default-included add-ons ticked, and the matching total', () => {
    render(<RenderPackages block={block} branding={branding} doc={doc} />)
    const articles = screen.getAllByRole('article')
    expect(articles[1]).toHaveAttribute('aria-pressed', 'true')
    expect(articles[0]).toHaveAttribute('aria-pressed', 'false')
    expect(within(articles[1] as HTMLElement).getByText(totalFor('opt-2', ['i-7']))).toBeInTheDocument()
  })

  it('clicking the other option CTA calls onSelectOption', () => {
    const onSelectOption = vi.fn()
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ onSelectOption }} />)
    const articles = screen.getAllByRole('article')
    fireEvent.click(within(articles[0] as HTMLElement).getByRole('button', { name: block.ctaLabel }))
    expect(onSelectOption).toHaveBeenCalledWith('opt-1')
  })

  it('clicking an add-on checkbox calls onToggleAddon with the item id', () => {
    const onToggleAddon = vi.fn()
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ onToggleAddon }} />)
    const articles = screen.getAllByRole('article')
    const checkbox = within(articles[1] as HTMLElement).getByLabelText(/Travel outside Melbourne/)
    fireEvent.click(checkbox)
    expect(onToggleAddon).toHaveBeenCalledWith('i-8')
  })

  it("shows a non-selected card's own default-included add-ons ticked, as a preview", () => {
    // opt-1 selected explicitly, so opt-2 (position 1) renders non-selected;
    // opt-2's "Rehearsal attendance" item is default_included, so its card
    // should preview that tick even though it isn't the current choice.
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ selectedOptionId: 'opt-1' }} />)
    const articles = screen.getAllByRole('article')
    const rehearsalCheckbox = within(articles[1] as HTMLElement).getByLabelText(/Rehearsal attendance/) as HTMLInputElement
    expect(rehearsalCheckbox.checked).toBe(true)
    const travelCheckbox = within(articles[1] as HTMLElement).getByLabelText(/Travel outside Melbourne/) as HTMLInputElement
    expect(travelCheckbox.checked).toBe(false)
  })

  it('clicking an add-on on a non-selected card first selects it, then toggles the add-on', () => {
    const onSelectOption = vi.fn()
    const onToggleAddon = vi.fn()
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ onSelectOption, onToggleAddon }} />)
    const articles = screen.getAllByRole('article')
    // articles[0] is opt-1, not selected (opt-2 is popular and selected by default).
    const checkbox = within(articles[0] as HTMLElement).getByLabelText(/Travel outside Melbourne/)
    fireEvent.click(checkbox)
    expect(onSelectOption).toHaveBeenCalledWith('opt-1')
    expect(onToggleAddon).toHaveBeenCalledWith('i-4')
    expect(onSelectOption.mock.invocationCallOrder[0] ?? 0).toBeLessThan(onToggleAddon.mock.invocationCallOrder[0] ?? 0)
  })

  it('an extra selected add-on raises the live total on the selected card', () => {
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ selectedOptionId: 'opt-2', selectedAddonIds: ['i-7', 'i-8'] }} />)
    const articles = screen.getAllByRole('article')
    expect(within(articles[1] as HTMLElement).getByText(totalFor('opt-2', ['i-7', 'i-8']))).toBeInTheDocument()
  })

  it('showInclusions false hides the inclusion list', () => {
    render(<RenderPackages block={{ ...block, showInclusions: false }} branding={branding} doc={doc} />)
    expect(screen.queryByText('Reception hosting (6 hours)')).toBeNull()
  })

  it('an accepted state shows "Your choice" on the accepted card with no CTAs and disabled checkboxes', () => {
    const acceptedDoc = { ...doc, proposal: { ...proposal, state: 'accepted' as const, acceptedOptionId: 'opt-2', acceptedAddonIds: ['i-7'] } }
    render(<RenderPackages block={block} branding={branding} doc={acceptedDoc} />)
    expect(screen.getByText('Your choice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: block.ctaLabel })).toBeNull()
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled()
  })

  it('renders the deposit line from depositPercent', () => {
    render(<RenderPackages block={block} branding={branding} doc={doc} proposal={{ selectedOptionId: 'opt-2', selectedAddonIds: ['i-7'] }} />)
    expect(screen.getByText(/deposit/)).toBeInTheDocument()
  })
})
