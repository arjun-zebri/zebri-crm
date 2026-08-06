/**
 * "Which add-ons?" step when applying a package that offers optional
 * extras.
 *
 * Opens over the builder after the MC picks a package with add-ons:
 * base items are listed as included, add-ons are tickable with their
 * prices. Apply proceeds with the ticked extras; Cancel aborts the
 * whole apply (nothing changes). Shared by the quote and invoice
 * builders.
 *
 * @module components/builders/parts/add-on-picker-dialog
 */
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

import type { ApplyItem } from './use-apply-sources'

interface AddOnPickerDialogProps {
  open: boolean
  packageName: string
  addOns: ApplyItem[]
  /** Apply with the ticked add-ons (possibly none). */
  onApply: (chosen: ApplyItem[]) => void
  /** Abort the apply entirely. */
  onCancel: () => void
}

/** AUD, whole dollars: matches the builders' items table. */
function formatAUD(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function AddOnPickerDialog({ open, ...contentProps }: AddOnPickerDialogProps) {
  // Unmounted while closed so each open mounts fresh: ticks from a
  // prior apply can't silently carry over to a different package.
  if (!open) return null
  return <AddOnPickerContent {...contentProps} />
}

function AddOnPickerContent({
  packageName,
  addOns,
  onApply,
  onCancel,
}: Omit<AddOnPickerDialogProps, 'open'>) {
  const [checked, setChecked] = useState<boolean[]>(() => addOns.map(() => false))

  const chosenCount = checked.filter(Boolean).length

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/20" onClick={onCancel} />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-label={`Add-ons for ${packageName}`}
          className="pointer-events-auto w-full max-w-sm rounded-control border border-border bg-card shadow-xl"
        >
          <div className="px-5 py-5">
            <h3 className="text-base font-semibold text-text">Include add-ons?</h3>
            <p className="mt-1 text-body text-text-muted">
              {packageName} offers optional extras. Tick the ones this couple wants.
            </p>

            <div className="mt-4 space-y-2.5">
              {addOns.map((addOn, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Checkbox
                    checked={checked[i] ?? false}
                    onChange={(v) =>
                      setChecked((prev) => prev.map((c, j) => (j === i ? v : c)))
                    }
                    label={addOn.description}
                  />
                  <span className="shrink-0 text-body tabular-nums text-text-muted">
                    + {formatAUD(addOn.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => onApply(addOns.filter((_, i) => checked[i]))}>
                {chosenCount > 0
                  ? `Apply with ${String(chosenCount)} add-on${chosenCount === 1 ? '' : 's'}`
                  : 'Apply without add-ons'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
