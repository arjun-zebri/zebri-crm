'use client'

import { useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PackagesBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicProposalOption } from '@/lib/proposals/public-types'

import type { PublicBranding } from '../../public-surface'
import { richTextHasContent } from '../../render-rich-text'
import { resolveTemplateString } from '../../template-string'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import type { ProposalSlotProps, PublicDocData, PublicDocProposal } from '../shared'

import { CarouselControls } from './carousel-controls'
import { PackageCard, type PackageCardSlots } from './package-card'

/**
 * Editor slots: a heading replacement, per-card slots (the template
 * editor edits each package in place, see `PackageCardSlots`), and a
 * trailing grid cell for the editor's "Add package" tile. No text-below
 * slot (2026-09-19 feedback: "remove the text from all these sections...
 * we can always add text sections around them") - a deposit or
 * cancellation note belongs in its own text section stacked below, not
 * embedded in this block.
 */
export interface PackagesSlots {
  heading?: ReactNode
  card?: (option: PublicProposalOption, index: number, isSelected: boolean) => PackageCardSlots
  /** Rendered as one more cell after the cards (same grid, so it sizes like a card). Not shown in the phone carousel (`block.mobileLayout === 'carousel'`): the editor's own device toggle switches back to desktop to add a card. */
  trailing?: ReactNode
}

/**
 * Which option and add-ons are "current" given an explicit slot selection, an
 * accepted snapshot, or the defaults. Pure so the public page, the editor
 * canvas and this module's tests all agree on one rule:
 * explicit selection > accepted snapshot > the popular option > the first
 * option; add-ons default to whichever are `default_included` on the
 * resolved option.
 */
export function resolveSelection(
  p: PublicDocProposal,
  slot: ProposalSlotProps | undefined,
  opts?: { defaultSelection?: boolean },
): { optionId: string | null; addonIds: string[] } {
  // `defaultSelection: false` (2026-09-18 fix): the template editor and its
  // Preview overlay render this same function with no real `slot`, same as
  // a fresh real proposal - but a template preview has no couple making a
  // choice, so the "highlight the popular/first card" fallback below,
  // which is exactly the right default for a real proposal page, reads as
  // a stray "Selected" CTA with no explanation in the editor. Every other
  // caller (the real public page, the legacy Branding block preview) omits
  // `opts` and keeps the fallback.
  const useFallback = opts?.defaultSelection ?? true
  const fallback = useFallback ? (p.options.find((o) => o.is_popular) ?? p.options[0] ?? null) : null
  const optionId = slot?.selectedOptionId ?? p.acceptedOptionId ?? fallback?.id ?? null
  const option = p.options.find((o) => o.id === optionId)
  const addonIds =
    slot?.selectedAddonIds !== undefined
      ? [...slot.selectedAddonIds]
      : p.acceptedOptionId
        ? p.acceptedAddonIds
        : (option?.items ?? []).filter((i) => i.is_addon && i.default_included).map((i) => i.id)
  return { optionId, addonIds }
}

/**
 * The couple's package choices: one card per option, with inclusions,
 * add-ons and a live total. Renders nothing without proposal data: the
 * editor canvas and preview route always pass the sample doc, so this only
 * ever happens on a non-proposal surface, where the block cannot occur.
 */
/** Card grid columns: 2 at `@md`, 3 at `@lg`, as `auto-fit` fixed tracks so `justify-content` can park a partial row (see the `gridCls` comment). */
const GRID_TRACKS =
  '@md/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-1rem)/2-0.02px)))] @lg/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-2rem)/3-0.02px)))] [justify-content:var(--doc-box-justify,start)]'

export function RenderPackages({
  block,
  branding,
  doc,
  proposal,
  slots,
  variableValues,
  options,
  defaultSelection,
}: {
  block: PackagesBlock
  branding: PublicBranding
  doc: PublicDocData
  proposal?: ProposalSlotProps | undefined
  slots?: PackagesSlots
  variableValues?: Record<string, string>
  /**
   * The packages the section authors itself (`features/proposals/model/packages.ts`),
   * in place of the proposal's own. Given on every template surface; a
   * sent proposal's page leaves it out and renders its `proposal_options`.
   */
  options?: PublicProposalOption[] | undefined
  /** `false` in every template-only surface (the editor canvas, its Preview overlay, the thumbnail) - see {@link resolveSelection}. Omitted (`true`) on the real public page. */
  defaultSelection?: boolean | undefined
}) {
  // Unconditional (rules-of-hooks): `doc.proposal` can go from set to unset
  // across a re-render of the same mounted instance, so this can't sit
  // after the early return below. Only read when `mobileLayout` is
  // `carousel` (see the render branch), but always allocated.
  const [mobileIndex, setMobileIndex] = useState(0)

  if (!doc.proposal) return null
  const p = options ? { ...doc.proposal, options } : doc.proposal
  const locked = p.state !== 'open'
  // Conditional spread (exactOptionalPropertyTypes): `defaultSelection` is
  // `boolean | undefined` here, but the options type only accepts the key
  // when it's actually a boolean - omit the key entirely rather than pass
  // an explicit `undefined`.
  const { optionId, addonIds } = resolveSelection(p, proposal, {
    ...(defaultSelection !== undefined ? { defaultSelection } : {}),
  })

  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))

  const gridCls =
    block.layout === 'stacked'
      ? 'flex flex-col gap-4'
      // `auto-rows-fr` (2026-09-18 fix): a 4th+ card wraps to its own grid
      // row, which by default sizes to only that row's own tallest card -
      // a shorter second row breaks the "every card is the same height"
      // rule the moment there are more than a row's worth of packages.
      // `grid-auto-rows: minmax(0, 1fr)` on an intrinsically-sized grid
      // equalizes every row to the tallest one across the whole grid.
      // `auto-fit` over fixed-width tracks (each column exactly the width
      // a `grid-cols-N` track would be, less a hair so rounding can never
      // drop a column), not `grid-cols-N`: N `1fr` tracks always fill the
      // row, so `justify-content` could never move a lone card. With
      // `auto-fit` a partial row's empty tracks collapse and the row parks
      // where the section's alignment says (`--doc-box-justify`, published
      // by the proposal content column; `start` when unset, i.e. today's
      // layout). `auto-rows-fr` keeps every row card-height-equal as before.
      : `grid auto-rows-fr gap-4 ${GRID_TRACKS} ${p.options.length === 1 && !slots?.trailing ? 'max-w-doc-narrow mx-auto' : ''}`

  const renderCard = (option: PublicProposalOption, index: number) => {
    const isSelected = option.id === optionId
    // A non-selected card previews its own default add-ons (what the
    // couple would get by switching to it), not the selected card's
    // ticks, which belong to a different option's items entirely.
    const cardAddonIds = isSelected
      ? addonIds
      : option.items.filter((i) => i.is_addon && i.default_included).map((i) => i.id)
    return (
      <PackageCard
        key={option.id}
        option={option}
        branding={branding}
        selected={isSelected}
        locked={locked}
        showInclusions={block.showInclusions}
        // A card's own CTA label/colours (2026-09-19 feedback: "we just
        // want it for that card") win over the section's shared default;
        // a plain string, so `{{ id | fallback }}` text stands in for a
        // chip in the section default.
        ctaLabel={option.cta_label ?? resolveTemplateString(block.ctaLabel, variableValues ?? {})}
        ctaBackgroundColor={option.cta_background_color ?? block.ctaBackgroundColor}
        ctaTextColor={option.cta_text_color ?? block.ctaTextColor}
        cardBackgroundColor={block.cardBackgroundColor}
        addonIds={cardAddonIds}
        onSelect={() => proposal?.onSelectOption?.(option.id)}
        onToggleAddon={proposal?.onToggleAddon}
        slots={slots?.card?.(option, index, isSelected)}
      />
    )
  }

  const cards = (
    <div className={gridCls}>
      {p.options.map((option, index) => renderCard(option, index))}
      {slots?.trailing}
    </div>
  )
  const safeMobileIndex = Math.min(mobileIndex, Math.max(0, p.options.length - 1))

  return (
    <div>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      {block.mobileLayout === 'carousel' ? (
        <>
          {/* Desktop/tablet keeps the grid; only a phone-width container swaps to one card at a time. */}
          <div className="hidden @md/doc:block">{cards}</div>
          <div className="@md/doc:hidden">
            {/* Every card stacks in the same grid cell so the swipe area
                sizes to the tallest one, not whichever card is current -
                otherwise the section's height jumped on every swipe to
                match just that card's own content. Only the current card
                is visible; the rest are `inert` so they take no part in
                focus or a screen reader's pass. */}
            <div className="grid">
              {p.options.map((option, index) => (
                <div
                  key={option.id}
                  className={`col-start-1 row-start-1 ${index === safeMobileIndex ? '' : 'invisible'}`}
                  inert={index === safeMobileIndex ? undefined : true}
                >
                  {renderCard(option, index)}
                </div>
              ))}
            </div>
            <CarouselControls
              branding={branding}
              index={safeMobileIndex}
              count={p.options.length}
              noun="package"
              onPrev={() => setMobileIndex((i) => (i - 1 + p.options.length) % p.options.length)}
              onNext={() => setMobileIndex((i) => (i + 1) % p.options.length)}
              onSelect={setMobileIndex}
              backgroundColor={block.carouselBackgroundColor}
              iconColor={block.carouselIconColor}
            />
          </div>
        </>
      ) : cards}
    </div>
  )
}
