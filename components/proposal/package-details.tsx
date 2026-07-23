/**
 * Renders the chosen package's description (marketing copy).
 *
 * @module components/proposal/package-details
 */
'use client'

import type { PackageDetailsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the chosen option's description if available.
 * Renders nothing if description is null.
 */
export function PackageDetails({ block }: { block: PackageDetailsBlock }) {
  const { options, chosenId } = useProposalBlock()

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen || !chosen.description) return null

  return (
    <div data-testid="package-details" className="text-sm text-text">
      {chosen.description}
    </div>
  )
}
