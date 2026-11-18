/**
 * "Add from package" popover for the invoice template form.
 *
 * Lists the MC's live packages with their base price, so it is clear
 * what pulling one in will add to the template total.
 *
 * @module app/(dashboard)/templates/template-source-picker
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Package as PackageIcon } from 'lucide-react'
import { useState } from 'react'

import { formatAUD } from '@/lib/payments/format'
import { packageTotals } from '@/lib/payments/package-math'

import type { TemplateSource } from './template-source-merge'

/** Popover trigger + package list; calls `onPick` and closes. */
export function TemplateSourcePicker({
  sources,
  onPick,
}: {
  sources: TemplateSource[]
  onPick: (s: TemplateSource) => void
}) {
  const [open, setOpen] = useState(false)
  const pick = (s: TemplateSource) => {
    onPick(s)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 text-body text-text-muted transition hover:text-text cursor-pointer"
        >
          <PackageIcon size={14} strokeWidth={1.5} />
          Add from package
          <ChevronDown size={13} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-72 rounded-control border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto">
            <p className="px-2 pt-2 pb-1 text-body font-medium text-text-subtle">Packages</p>
            {sources.map((s) => {
              const price = packageTotals(s.items, { pricingMode: s.pricingMode, fixedPrice: s.fixedPrice }).base
              return (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left hover:bg-surface-muted cursor-pointer"
                >
                  <span className="truncate text-body text-text">{s.name}</span>
                  <span className="shrink-0 text-body tabular-nums text-text-subtle">{formatAUD(price)}</span>
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
