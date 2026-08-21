'use client'

import * as Popover from '@radix-ui/react-popover'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

import type { Couple } from '@/types/couple'

import { formatPrice, usePackages } from './use-packages'

/**
 * MC-facing package selector for the couple profile Overview tab.
 *
 * Shows the couple's current package selection with an edit affordance.
 * The row is always rendered, never hidden: it reads "None selected" when
 * the MC has packages but this couple has none, and "No packages yet" only
 * when there is nothing to choose from. A field that hides itself when
 * empty is a field nobody discovers.
 *
 * Presentational: it reports the chosen id and the parent persists it
 * through the couple's single update path. Writing to Supabase from here as
 * well meant two writes per click, and the second one raced the first.
 *
 * Mirrors the Lead Source pattern: hover pencil affordance, same row
 * layout, same label column width, Popover chooser, design tokens only.
 */
export interface CouplePackageSelectorProps {
  couple: Couple
  /** Fires with the chosen package id, or null to clear the selection. */
  onSelect: (packageId: string | null) => void
}

export function CouplePackageSelector({ couple, onSelect }: CouplePackageSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [packagePopoverOpen, setPackagePopoverOpen] = useState(false)

  const { data: packages = [], isLoading } = usePackages(couple.user_id)

  // The chosen id is passed straight through rather than held in state:
  // setState is async, so reading it back here persisted the PREVIOUS
  // choice (picking a package wrote whatever was selected before it).
  const choose = (packageId: string | null) => {
    onSelect(packageId)
    setIsEditing(false)
    setPackagePopoverOpen(false)
  }

  const selectedPackage = packages.find((p) => p.id === couple.selected_package_id)
  const selectedLabel = selectedPackage
    ? `${selectedPackage.name} (${formatPrice(selectedPackage.total_amount)})`
    : null

  return (
    <div
      className="group flex items-center justify-between py-3 rounded-control -mx-2 px-2 cursor-pointer"
      onClick={() => {
        if (isEditing) return
        setIsEditing(true)
        setPackagePopoverOpen(true)
      }}
    >
      <span className="text-body text-text-muted w-28 shrink-0">Package</span>

      {isEditing ? (
        <Popover.Root
          open={packagePopoverOpen}
          onOpenChange={(open) => {
            setPackagePopoverOpen(open)
            if (!open) setIsEditing(false)
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              className="flex-1 flex items-center justify-end gap-1 text-body bg-transparent outline-none border-none cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <span className={selectedLabel ? 'text-text' : 'text-text-subtle'}>
                {selectedLabel ?? (packages.length === 0 ? 'No packages yet' : 'None selected')}
              </span>
              <Pencil size={11} className="opacity-60 shrink-0 text-text-muted" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-surface border border-border rounded-control shadow-lg py-1 z-[70] w-64"
              sideOffset={4}
              align="end"
            >
              {isLoading ? (
                <div className="px-3 py-2 text-body text-text-muted">Loading packages...</div>
              ) : packages.length === 0 ? (
                <div className="px-3 py-2 text-body text-text-muted">No packages yet</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      choose(null)
                    }}
                    className={`w-full text-left px-3 py-2 text-body transition ${
                      !couple.selected_package_id
                        ? 'bg-surface-emphasis text-text font-medium'
                        : 'text-text-muted hover:bg-surface-emphasis'
                    }`}
                  >
                    None
                  </button>
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        choose(pkg.id)
                      }}
                      className={`w-full text-left px-3 py-2 text-body transition ${
                        couple.selected_package_id === pkg.id
                          ? 'bg-surface-emphasis text-text font-medium'
                          : 'text-text-muted hover:bg-surface-emphasis'
                      }`}
                    >
                      {pkg.name} ({formatPrice(pkg.total_amount)})
                    </button>
                  ))}
                </>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
          {selectedLabel ? (
            <span className="text-body text-text-muted">{selectedLabel}</span>
          ) : (
            // Distinct empty states: nothing to choose from yet, versus
            // packages that exist but none picked for this couple.
            <span className="text-body text-text-subtle">
              {packages.length === 0 ? 'No packages yet' : 'None selected'}
            </span>
          )}
          <Pencil
            size={11}
            className="opacity-0 group-hover:opacity-60 shrink-0 text-text-subtle"
          />
        </div>
      )}
    </div>
  )
}
