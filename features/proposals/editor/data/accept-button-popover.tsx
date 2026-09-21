'use client'

/**
 * The accept section's button label + colour editor (Slice E1, UX audit
 * 3.4). Looks exactly like the public `RenderAccept` button at rest -
 * same background/colour/radius, same padding - but a click opens a
 * small popover with a "Button label" `Input` and a `ColorPopover`
 * swatch instead of firing the real Accept action, which only exists on
 * the public page: `type="button"` with no `onClick` reaching
 * `proposal?.onAccept`, so nothing here can ever advance a real
 * proposal's state.
 *
 * @module features/proposals/editor/data/accept-button-popover
 */
import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { getTextColor } from '@/lib/branding/contrast'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { LabelWithVariables } from './label-with-variables'

/** Props for {@link AcceptButtonPopover}. */
export interface AcceptButtonPopoverProps {
  buttonLabel: string
  buttonColor: string | undefined
  branding: PublicBranding
  swatches: readonly string[]
  /** Fired when the popover opens, so the caller can select the owning section (mirrors every other field's `onFocus`). */
  onFocus: () => void
  onChangeLabel: (label: string) => void
  onChangeColor: (color: string) => void
}

/** The accept button, editable in place: its label and colour open in a popover instead of the button navigating. */
export function AcceptButtonPopover({
  buttonLabel, buttonColor, branding, swatches, onFocus, onChangeLabel, onChangeColor,
}: AcceptButtonPopoverProps) {
  const color = buttonColor ?? branding.brand_color
  // Buffered locally and committed on blur, like the packages CTA label:
  // wired straight to the layout with `commit: true` every keystroke
  // became its own undo step (review finding), and a plain string field
  // has no editor debounce of its own to coalesce them.
  const [label, setLabel] = useState(buttonLabel)

  return (
    <Popover.Root onOpenChange={(open) => { if (open) { onFocus(); setLabel(buttonLabel) } }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          style={{ background: color, color: getTextColor(color), borderRadius: branding.button_radius }}
          className="cursor-pointer px-8 py-4 text-lg font-semibold"
        >
          {buttonLabel || 'Accept'}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" sideOffset={8} className="z-[60] w-[260px] animate-modal-in rounded-control border border-border bg-surface p-3 shadow-xl">
          <div className="flex flex-col gap-3">
            <LabelWithVariables label="Button label" value={label} onChange={setLabel} onBlur={() => { if (label !== buttonLabel) onChangeLabel(label) }} />
            <div className="flex items-center justify-between">
              <span className="text-body font-medium text-text">Colour</span>
              <ColorPopover
                value={color}
                onChange={onChangeColor}
                swatches={swatches}
                trigger={
                  <button
                    type="button"
                    aria-label="Button colour"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-control hover:bg-surface-emphasis"
                  >
                    <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color }} />
                  </button>
                }
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
