/**
 * Renders the chosen package title with a subtle package switcher when
 * multiple options exist.
 *
 * @module components/proposal/package-header
 */
'use client'

import { useState } from 'react'
import type { PackageHeaderBlock } from '@/app/(dashboard)/branding/blocks/types'
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import { useProposalBlock } from './proposal-block-context'

/**
 * Renders the package header with title and optional package switcher.
 * When multiple options are available, shows a subtle text button to
 * toggle the package chooser.
 */
export function PackageHeader({ block }: { block: PackageHeaderBlock }) {
  const { options, chosenId, onChoose } = useProposalBlock()
  const [showChooser, setShowChooser] = useState(false)

  const chosen = options.find((o) => o.id === chosenId) ?? options[0]
  if (!chosen) return null

  const hasMultipleOptions = options.length > 1

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{chosen.title}</h2>
        {hasMultipleOptions && (
          <button
            onClick={() => setShowChooser(!showChooser)}
            className="text-text-muted text-sm cursor-pointer hover:text-text transition-colors"
          >
            See other packages
          </button>
        )}
      </div>

      {showChooser && hasMultipleOptions && (
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="package-chooser"
                value={option.id}
                checked={option.id === chosenId}
                onChange={() => {
                  onChoose?.(option.id)
                  setShowChooser(false)
                }}
                className="cursor-pointer"
              />
              <span className="text-sm">{option.title}</span>
              {option.is_popular && (
                <span className="text-xs font-semibold bg-brand text-white px-2 py-1 rounded">
                  Most popular
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
