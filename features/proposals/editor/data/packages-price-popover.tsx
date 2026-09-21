'use client'

/**
 * A fixed-price card's price, editable in place (2026-09-18 feedback:
 * first "editing the pricing like Qwilr does", then "no border" and "it
 * should also have frequency, make that part look like the Qwilr
 * screenshot"): a plain, borderless figure - the same "no boxed-in-a-box
 * chrome" rule `InlineField` follows for text - that opens a small popover
 * with the item price, a billing frequency picker and a decimal-places
 * picker together, like Qwilr's own popup. Frequency and decimals are
 * template-only for now (`PackageOption.priceFrequency`/`priceDecimals`'s
 * own doc comments): they show here and on the template preview, but are
 * dropped when a proposal is sent until a later migration carries them
 * through to `proposal_options`.
 *
 * @module features/proposals/editor/data/packages-price-popover
 */
import * as Popover from '@radix-ui/react-popover'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import { Select, type SelectOption } from '@/components/editor'
import { fmt } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { roleDefaults } from '@/lib/branding/type-defaults'
import {
  PACKAGE_PRICE_DECIMALS, PACKAGE_PRICE_DECIMALS_LABELS, PACKAGE_PRICE_FREQUENCIES, PACKAGE_PRICE_FREQUENCY_LABELS,
  PACKAGE_PRICE_FREQUENCY_SUFFIX, type PackagePriceDecimals, type PackagePriceFrequency,
} from '@/lib/proposals/types'

import { InlineNumber } from './inline-number'

const FREQUENCY_OPTIONS: SelectOption<PackagePriceFrequency>[] = PACKAGE_PRICE_FREQUENCIES.map((value) => ({
  value, label: PACKAGE_PRICE_FREQUENCY_LABELS[value],
}))

const DECIMALS_OPTIONS: SelectOption<PackagePriceDecimals>[] = PACKAGE_PRICE_DECIMALS.map((value) => ({
  value, label: PACKAGE_PRICE_DECIMALS_LABELS[value],
}))

/** Props for {@link PackagesPricePopover}. */
export interface PackagesPricePopoverProps {
  /** Dollars. */
  value: number
  /** Accessible name for the popover's number field, e.g. "Price for Reception MC". */
  label: string
  max: number
  frequency: PackagePriceFrequency
  decimals: PackagePriceDecimals
  branding: PublicBranding
  onFocus: () => void
  onCommit: (value: number) => void
  onCommitFrequency: (frequency: PackagePriceFrequency) => void
  onCommitDecimals: (decimals: PackagePriceDecimals) => void
}

/** A package's fixed price, editable in place: a plain figure that opens a popover with the amount, billing frequency and decimal-places together. */
export function PackagesPricePopover({
  value, label, max, frequency, decimals, branding, onFocus, onCommit, onCommitFrequency, onCommitDecimals,
}: PackagesPricePopoverProps) {
  const totalStyle = resolveTextStyle(undefined, roleDefaults(branding, 'total'))

  return (
    <Popover.Root onOpenChange={(open) => { if (open) onFocus() }}>
      <Popover.Trigger asChild>
        <button type="button" className="-mx-1 -my-0.5 rounded-control px-1 py-0.5 text-left transition hover:bg-surface-emphasis/60">
          <span style={totalStyle}>{fmt(value, decimals === 'whole' ? 0 : 2)}{PACKAGE_PRICE_FREQUENCY_SUFFIX[frequency]}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" sideOffset={8} className="z-[60] w-[220px] animate-modal-in space-y-3 rounded-control border border-border bg-surface p-3 shadow-xl">
          <div>
            <span className="mb-1 block text-body font-medium text-text">Item price</span>
            <div className="flex h-8 w-full items-center rounded-control border border-border bg-surface px-2 focus-within:border-border-strong">
              <InlineNumber
                value={value}
                label={label}
                max={max}
                decimals={decimals}
                onCommit={onCommit}
                className="text-lg"
              />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-body font-medium text-text">Billing frequency</span>
            <Select value={frequency} options={FREQUENCY_OPTIONS} onChange={onCommitFrequency} size="sm" />
          </div>
          <div>
            <span className="mb-1 block text-body font-medium text-text">Price format</span>
            <Select value={decimals} options={DECIMALS_OPTIONS} onChange={onCommitDecimals} size="sm" />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
