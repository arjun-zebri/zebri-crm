'use client'

/**
 * One package card's editor slots (founder ruling 2026-09-18, "Qwilr-style:
 * click a package and edit it"): the title, description and every priced
 * line are typed straight into the card the sent proposal renders
 * (`PackageCardSlots`, `lib/branding/public-blocks/proposal/package-card.tsx`),
 * the price is typed in place on a fixed-price card, an add-on's checkbox
 * sets whether it is ticked by default, and the card's corner holds the
 * menu (`package-card-menu.tsx`) for everything that is not text.
 *
 * Text streams with `commit: false` (one history entry per pause, like
 * every other data field); amounts, ticks and line add/remove commit at
 * once, since each is a discrete change.
 *
 * @module features/proposals/editor/data/edit-package-card
 */
import { Check, Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'

import type { PackageCardSlots } from '@/lib/branding/public-blocks/proposal/package-card'
import type { PublicProposalItem } from '@/lib/proposals/public-types'

import { plainText } from '../../model/doc'
import { PACKAGE_LIMITS, newPackageItem, type PackageItem, type PackageOption } from '../../model/packages'

import { focusNewItem } from './focus-new-item'
import { InlineField } from './inline-field'
import { InlineNumber } from './inline-number'
import { setPackageOptions, type PackageCardArgs } from './package-args'
import { PackageCardMenu } from './package-card-menu'
import { PackagesButtonPopover } from './packages-button-popover'
import { PackagesPricePopover } from './packages-price-popover'

/** Builds the `PackageCardSlots` for the card at `index`. `isSelected` mirrors the same option resolution `RenderPackages` uses, so the CTA slot shows the same "Selected" state as the public card. */
export function packageCardSlots(args: PackageCardArgs, option: PackageOption, index: number, isSelected: boolean): PackageCardSlots {
  const { options, externalVersion, onFocus, branding, theme, swatches } = args
  const richTextBar = { theme, swatches }
  const itemised = option.pricingMode === 'itemised'
  // One price format per card: the fixed price, each inclusion amount and
  // each add-on amount all rest, edit and round the same way.
  const decimals = option.priceDecimals ?? 'cents'

  const patch = (next: Partial<PackageOption>, commit: boolean) =>
    setPackageOptions(args, options.map((o) => (o.id === option.id ? { ...o, ...next } : o)), commit)
  const patchItem = (itemId: string, next: Partial<PackageItem>, commit: boolean) =>
    patch({ items: option.items.map((it) => (it.id === itemId ? { ...it, ...next } : it)) }, commit)
  const removeItem = (itemId: string) => patch({ items: option.items.filter((it) => it.id !== itemId) }, true)
  const addItem = (isAddon: boolean) => {
    const item = newPackageItem(isAddon)
    patch({ items: [...option.items, item] }, true)
    focusNewItem(args.sectionId, item.id)
  }
  const removeButton = (item: PublicProposalItem): ReactNode => (
    <button
      type="button"
      aria-label={`Remove ${item.is_addon ? 'add-on' : 'inclusion'} ${item.description || ''}`.trim()}
      onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-subtle opacity-0 transition hover:text-text focus-visible:opacity-100 group-hover/line:opacity-100"
    >
      <X size={14} strokeWidth={1.5} />
    </button>
  )

  const description = (rawItem: PackageItem, placeholder: string): ReactNode => (
    <InlineField
      value={rawItem.description}
      placeholder={placeholder}
      singleLine
      className="[&_p]:m-0"
      externalVersion={externalVersion}
      onFocus={onFocus}
      richTextBar={richTextBar}
      onChange={(json) => patchItem(rawItem.id, { description: json }, false)}
    />
  )

  const atItemCap = option.items.length >= PACKAGE_LIMITS.maxItems

  const rawItem = (item: PublicProposalItem): PackageItem => option.items.find((it) => it.id === item.id) ?? { ...newPackageItem(item.is_addon), id: item.id }
  const titleText = plainText(option.title)

  return {
    corner: <PackageCardMenu args={args} option={option} index={index} />,
    title: (
      <InlineField
        value={option.title}
        placeholder="Package name"
        singleLine
        className="[&_p]:m-0"
        externalVersion={externalVersion}
        onFocus={onFocus}
        richTextBar={richTextBar}
        onChange={(json) => patch({ title: json }, false)}
      />
    ),
    description: (
      <InlineField
        value={option.description}
        placeholder="One line on who this is for"
        singleLine
        className="[&_p]:m-0"
        externalVersion={externalVersion}
        onFocus={onFocus}
        richTextBar={richTextBar}
        onChange={(json) => patch({ description: json }, false)}
      />
    ),
    // An itemised card's price is the sum of its lines; only a fixed price is typed here.
    ...(itemised ? {} : {
      price: (
        <PackagesPricePopover
          value={option.fixedPrice ?? 0}
          label={`Price for ${titleText || 'package'}`}
          max={PACKAGE_LIMITS.maxAmount}
          frequency={option.priceFrequency ?? 'one_time'}
          decimals={decimals}
          branding={branding}
          onFocus={onFocus}
          onCommit={(fixedPrice) => patch({ fixedPrice }, true)}
          onCommitFrequency={(priceFrequency) => patch({ priceFrequency }, true)}
          onCommitDecimals={(priceDecimals) => patch({ priceDecimals }, true)}
        />
      ),
    }),
    item: (item) => (
      <div key={item.id} data-item-id={item.id} className="group/line flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Check size={16} strokeWidth={1.5} style={{ color: branding.brand_color }} aria-hidden="true" />
          <span className="min-w-0 flex-1">{description(rawItem(item), 'Inclusion')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1" style={{ color: branding.muted_color }}>
          {itemised ? (
            <InlineNumber
              value={item.amount}
              label={`Amount for ${item.description || 'inclusion'}`}
              max={PACKAGE_LIMITS.maxAmount}
              decimals={decimals}
              onFocus={onFocus}
              onCommit={(amount) => patchItem(item.id, { amount }, true)}
            />
          ) : null}
          {removeButton(item)}
        </span>
      </div>
    ),
    addon: (item) => (
      <div key={item.id} data-item-id={item.id} className="group/line flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Ticked by default: ${item.description || 'add-on'}`}
          checked={item.default_included}
          onChange={() => patchItem(item.id, { defaultIncluded: !item.default_included }, true)}
          onClick={(e) => e.stopPropagation()}
          style={{ accentColor: branding.brand_color }}
        />
        <span className="min-w-0 flex-1">{description(rawItem(item), 'Add-on')}</span>
        <span className="flex shrink-0 items-center gap-1" style={{ color: branding.muted_color }}>
          <span aria-hidden="true">+</span>
          <InlineNumber
            value={item.amount}
            label={`Amount for ${item.description || 'add-on'}`}
            max={PACKAGE_LIMITS.maxAmount}
            decimals={decimals}
            onFocus={onFocus}
            onCommit={(amount) => patchItem(item.id, { amount }, true)}
          />
          {removeButton(item)}
        </span>
      </div>
    ),
    footer: atItemCap ? null : (
      <div className="flex flex-wrap gap-2">
        <AddLineButton label="Add inclusion" onClick={() => addItem(false)} />
        <AddLineButton label="Add add-on" onClick={() => addItem(true)} />
      </div>
    ),
    cta: (
      // A card's own CTA label/colours (2026-09-19 feedback: "we just
      // want it for that card where we are changing it") override the
      // section's shared default (`args.data.ctaLabel` etc) for this
      // card only - `patch` writes to this option, never the section.
      <PackagesButtonPopover
        ctaLabel={option.ctaLabel ?? args.data.ctaLabel}
        backgroundColor={option.ctaBackgroundColor ?? args.data.ctaBackgroundColor}
        textColor={option.ctaTextColor ?? args.data.ctaTextColor}
        selected={isSelected}
        branding={branding}
        swatches={swatches}
        onFocus={onFocus}
        onChangeLabel={(ctaLabel) => patch({ ctaLabel }, true)}
        onChangeBackgroundColor={(ctaBackgroundColor) => patch({ ctaBackgroundColor }, true)}
        onChangeTextColor={(ctaTextColor) => patch({ ctaTextColor }, true)}
      />
    ),
  }
}

/** A small in-card "Add ..." control, in the editor's own tokens (it never ships). */
function AddLineButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-control px-2 text-body text-text-muted transition hover:bg-surface-emphasis hover:text-text"
    >
      <Plus size={14} strokeWidth={1.5} />
      {label}
    </button>
  )
}
