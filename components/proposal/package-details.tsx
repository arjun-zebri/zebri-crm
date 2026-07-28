/**
 * Renders the chosen package's description (marketing copy).
 *
 * Styling mirrors the invoice text block: body copy pulls from the MC's
 * branding via the body role + the block's style override. Horizontal document
 * padding comes from the block wrapper; the block carries only vertical rhythm.
 *
 * @module components/proposal/package-details
 */
'use client'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageDetailsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the chosen option's description. On the sent document it renders
 * nothing (and so contributes no padding) when the option has no description.
 *
 * @param block - The packageDetails block carrying any body style override.
 * @param variablePreview - Editor-only: the description is set per proposal, so
 *   the template shows a mint `{{ Package description }}` chip.
 */
export function PackageDetails({
  block,
  variablePreview = false,
}: {
  block: PackageDetailsBlock
  variablePreview?: boolean
}) {
  const { options, chosenId, branding } = useProposalBlock()

  const p = pad(branding)
  const defaults = roleDefaults(branding, 'body')

  if (variablePreview) {
    return (
      <div
        data-testid="package-details"
        className={p.blockY}
        style={resolveTextStyle(block.bodyStyle, defaults)}
      >
        <VarChip
          label="Package description"
          hint="The chosen package's description, filled from the proposal when it's sent."
        />
      </div>
    )
  }

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen || !chosen.description) return null

  return (
    <div
      data-testid="package-details"
      className={p.blockY}
      style={resolveTextStyle(block.bodyStyle, defaults)}
    >
      {caseText(chosen.description, block.bodyStyle, defaults)}
    </div>
  )
}
