'use client'

/**
 * The packages section's CTA button, editable in place (2026-09-18
 * feedback: matches `AcceptButtonPopover`'s pattern exactly - the button
 * looks like the public `PackageCard`'s at rest, same background/colour/
 * radius/border, but a click opens a small popover with the button's
 * label, background and text colour instead of firing the real select
 * action, which only exists on the public page. No `@` variable picker on
 * the label (2026-09-18 feedback: "we dont need these for button
 * labels") - unlike the accept button, a package CTA is always a short
 * static phrase ("Choose this package"), never one that names the couple.
 * Each card's label/colours default to the section's shared
 * `PackagesData.ctaLabel`/`ctaBackgroundColor`/`ctaTextColor`, but an edit
 * here writes to this card's own `PackageOption` fields only (2026-09-19
 * feedback: "we just want it for that card where we are changing it") -
 * every other card keeps showing the section default.
 *
 * @module features/proposals/editor/data/packages-button-popover
 */
import * as Popover from '@radix-ui/react-popover'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Input } from '@/components/ui/input'
import { getTextColor } from '@/lib/branding/contrast'
import type { PublicBranding } from '@/lib/branding/public-branding'

/** Props for {@link PackagesButtonPopover}. */
export interface PackagesButtonPopoverProps {
  ctaLabel: string
  /** Unset keeps `branding.brand_color`. */
  backgroundColor: string | undefined
  /** Unset keeps `getTextColor(backgroundColor ?? branding.brand_color)`. */
  textColor: string | undefined
  /** This card's own selected state - only changes what the button shows at rest (a "Selected" state matches the public card), never what clicking it does. */
  selected: boolean
  branding: PublicBranding
  swatches: readonly string[]
  /** Fired when the popover opens, so the caller can select the owning section (mirrors every other field's `onFocus`). */
  onFocus: () => void
  onChangeLabel: (label: string) => void
  onChangeBackgroundColor: (color: string) => void
  onChangeTextColor: (color: string) => void
}

/** One label-left, control-right row (same rhythm as the section Style popover). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body font-medium text-text">{label}</span>
      {children}
    </div>
  )
}

/** The packages CTA button, editable in place: its label and colours open in a popover instead of the button selecting a package. */
export function PackagesButtonPopover({
  ctaLabel, backgroundColor, textColor, selected, branding, swatches, onFocus, onChangeLabel, onChangeBackgroundColor, onChangeTextColor,
}: PackagesButtonPopoverProps) {
  // Buffered locally and committed on blur, like every other label field
  // here: wired straight to the layout with `commit: true` every
  // keystroke became its own undo step (review finding).
  const [label, setLabel] = useState(ctaLabel)
  const background = backgroundColor ?? branding.brand_color
  const color = textColor ?? getTextColor(background)

  const commitLabel = () => { if (label !== ctaLabel) onChangeLabel(label) }

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) { onFocus(); setLabel(ctaLabel) }
        // Also commit on close, not just the input's own blur: clicking
        // straight from the label field to "outside" fires Radix's
        // dismiss on pointerdown, which can close (and unmount) the
        // popover before the browser's blur event reaches the input -
        // the live check behind this fix ("clicking out of the popover
        // doesn't change the label").
        else commitLabel()
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="w-full rounded-control px-4 py-2"
          style={
            selected
              ? { border: `2px solid ${branding.brand_color}`, background: branding.surface_color, color: branding.brand_color }
              : { background, color }
          }
        >
          {selected ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={16} strokeWidth={1.5} aria-hidden="true" /> Selected
            </span>
          ) : (
            ctaLabel
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" sideOffset={8} className="z-[60] w-[260px] animate-modal-in space-y-3 rounded-control border border-border bg-surface p-3 shadow-xl">
          <Input
            label="Button label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
          />
          <Row label="Background">
            <ColorPopover
              value={background}
              onChange={onChangeBackgroundColor}
              swatches={swatches}
              trigger={
                <button
                  type="button"
                  aria-label="Button background colour"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
                >
                  <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background }} />
                </button>
              }
            />
          </Row>
          <Row label="Text colour">
            <ColorPopover
              value={color}
              onChange={onChangeTextColor}
              swatches={swatches}
              trigger={
                <button
                  type="button"
                  aria-label="Button text colour"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
                >
                  <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color }} />
                </button>
              }
            />
          </Row>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
