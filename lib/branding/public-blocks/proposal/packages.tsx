'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PackagesBlock } from '@/app/(dashboard)/branding/blocks/types'
import { depositAmount, optionTotal } from '@/lib/proposals/pricing'

import type { PublicBranding } from '../../public-surface'
import { richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import type { ProposalSlotProps, PublicDocData, PublicDocProposal } from '../shared'
import { fmt } from '../shared'

import { priced, PackageCard } from './package-card'

/** Editor slots: a heading replacement. Cards themselves have no slot (nothing in them is user-authored). */
export interface PackagesSlots {
  heading?: ReactNode
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
): { optionId: string | null; addonIds: string[] } {
  const fallback = p.options.find((o) => o.is_popular) ?? p.options[0] ?? null
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
export function RenderPackages({
  block,
  branding,
  doc,
  proposal,
  slots,
  variableValues,
}: {
  block: PackagesBlock
  branding: PublicBranding
  doc: PublicDocData
  proposal?: ProposalSlotProps | undefined
  slots?: PackagesSlots
  variableValues?: Record<string, string>
}) {
  if (!doc.proposal) return null
  const p = doc.proposal
  const locked = p.state !== 'open'
  const { optionId, addonIds } = resolveSelection(p, proposal)

  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const finePrintStyle = resolveTextStyle(undefined, roleDefaults(branding, 'finePrint'))

  const gridCls =
    block.layout === 'stacked'
      ? 'flex flex-col gap-4'
      : `grid gap-4 @md/doc:grid-cols-2 @lg/doc:grid-cols-3 ${p.options.length === 1 ? 'max-w-doc-narrow mx-auto' : ''}`

  const selectedOption = p.options.find((o) => o.id === optionId)
  const selectedTotal = selectedOption ? optionTotal(priced(selectedOption), addonIds) : 0

  return (
    <div>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      <div className={gridCls}>
        {p.options.map((option) => {
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
              ctaLabel={block.ctaLabel}
              addonIds={cardAddonIds}
              onSelect={() => proposal?.onSelectOption?.(option.id)}
              onToggleAddon={proposal?.onToggleAddon}
            />
          )
        })}
      </div>
      {!!p.depositPercent && (
        <p className="m-0 mt-4 text-center" style={{ ...finePrintStyle, color: branding.muted_color }}>
          A {p.depositPercent}% deposit ({fmt(depositAmount(selectedTotal, p.depositPercent))}) secures your date
        </p>
      )}
    </div>
  )
}
