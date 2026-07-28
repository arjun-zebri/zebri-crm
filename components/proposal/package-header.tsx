/**
 * Renders the chosen package's title (single-package view).
 *
 * Multi-package proposals no longer route through this block — they render the
 * compare-and-pick chooser instead (see {@link ProposalBlocksRenderer}) — so
 * this block only ever shows one package's title. Styling mirrors the invoice
 * title block: the heading pulls from the MC's branding via role defaults +
 * per-block style overrides. Horizontal document padding is applied once by the
 * block wrapper (BlockOuter); the block carries only its vertical rhythm.
 *
 * @module components/proposal/package-header
 */
'use client'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageHeaderBlock } from '@/app/(dashboard)/branding/blocks/types'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the single package's title.
 *
 * @param block - The packageHeader block carrying any title style override.
 * @param variablePreview - Editor-only: the package name is set when building a
 *   proposal in Payments, so the template shows a mint `{{ Package name }}` chip
 *   instead of concrete sample text. The sent document renders the real name.
 */
export function PackageHeader({
  block,
  variablePreview = false,
}: {
  block: PackageHeaderBlock
  variablePreview?: boolean
}) {
  const { options, chosenId, branding } = useProposalBlock()

  const p = pad(branding)
  // The package title is the document's primary heading on this surface, so it
  // takes the sectionHeading role (matching the current text-xl weight) rather
  // than the larger docTitle used by the "Invoice" word on invoices.
  const titleDefaults = roleDefaults(branding, 'sectionHeading')
  const titleCss = resolveTextStyle(block.titleStyle, titleDefaults)

  if (variablePreview) {
    return (
      <div className={p.blockY}>
        <h2 style={titleCss}>
          <VarChip
            label="Package name"
            hint="The chosen package's name, filled from the proposal when it's sent."
          />
        </h2>
      </div>
    )
  }

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  return (
    <div className={p.blockY}>
      <h2 style={titleCss}>{caseText(chosen.title, block.titleStyle, titleDefaults)}</h2>
    </div>
  )
}
