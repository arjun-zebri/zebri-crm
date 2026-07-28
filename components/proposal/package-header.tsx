/**
 * Renders the chosen package title with a subtle package switcher when
 * multiple options exist.
 *
 * Styling mirrors the invoice title block: the heading pulls from the MC's
 * branding via role defaults + per-block style overrides. Horizontal document
 * padding is applied once by the block wrapper (BlockOuter); the block only
 * carries its own vertical rhythm (`blockY`). No app design tokens reach this
 * public surface.
 *
 * @module components/proposal/package-header
 */
'use client'

import { useState } from 'react'

import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
import type { PackageHeaderBlock } from '@/app/(dashboard)/branding/blocks/types'
import { Button } from '@/components/ui/button'
import { getTextColor } from '@/lib/branding/contrast'
import { pad } from '@/lib/branding/public-blocks/shared'
import { VarChip } from '@/lib/branding/public-blocks/var-chip'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the package header with title and optional package switcher.
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
  const { options, chosenId, onChoose, branding } = useProposalBlock()
  const [showChooser, setShowChooser] = useState(false)

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

  const hasMultipleOptions = options.length > 1

  return (
    <div className={p.blockY}>
      <div className="flex items-center justify-between gap-4">
        <h2 style={titleCss}>{caseText(chosen.title, block.titleStyle, titleDefaults)}</h2>
        {hasMultipleOptions && (
          <Button variant="ghost" size="sm" onClick={() => setShowChooser(!showChooser)}>
            See other packages
          </Button>
        )}
      </div>

      {showChooser && hasMultipleOptions && (
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <Button
                variant={option.id === chosenId ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  onChoose?.(option.id)
                  setShowChooser(false)
                }}
                className="justify-start flex-1"
              >
                {option.title}
              </Button>
              {option.is_popular && (
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-xl whitespace-nowrap"
                  style={{
                    backgroundColor: branding.brand_color,
                    color: getTextColor(branding.brand_color),
                  }}
                >
                  Most popular
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
