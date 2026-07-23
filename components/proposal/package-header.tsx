/**
 * Renders the chosen package title with a subtle package switcher when
 * multiple options exist.
 *
 * @module components/proposal/package-header
 */
'use client'

import { useState } from 'react'
import type { PackageHeaderBlock } from '@/app/(dashboard)/branding/blocks/types'
import { Button } from '@/components/ui/button'
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChooser(!showChooser)}
          >
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
                <span className="text-xs font-semibold bg-brand text-white px-2 py-1 rounded-xl">
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
