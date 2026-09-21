'use client'

/**
 * A section-toolbar icon button and the popover behind it, styled exactly
 * like the toolbar's Style button (`section-style-popover.tsx`): the
 * packages and gallery settings (`../data/data-options-button.tsx`) ride
 * this so every toolbar popover shares one trigger, one radius and one
 * collision rule.
 *
 * @module features/proposals/editor/bars/toolbar-popover
 */
import * as Popover from '@radix-ui/react-popover'
import type { LucideIcon } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'

import { Tooltip } from '@/components/ui/tooltip'

/** Props for {@link ToolbarPopover}. */
export interface ToolbarPopoverProps {
  /** Accessible name and tooltip, e.g. "Packages". */
  label: string
  icon: LucideIcon
  boundsRef: RefObject<HTMLElement | null>
  /** Popover width class; defaults to the Style popover's. */
  widthClass?: string
  /**
   * Pulls the popover's left edge back from this trigger to the toolbar's
   * own left edge, so every toolbar popover opens in the same place. The
   * toolbar's `px-1` plus 1px border puts its first button 5px in
   * (`section-style-popover.tsx`); each button after that adds its 32px
   * width and the toolbar's 2px gap.
   */
  alignOffset?: number
  children: ReactNode
}

/** A toolbar icon button and its popover, styled exactly like the toolbar's Style button (`bars/section-style-popover.tsx`). */
export function ToolbarPopover({ label, icon: Icon, boundsRef, widthClass = 'w-[300px]', alignOffset = -5, children }: ToolbarPopoverProps) {
  const [open, setOpen] = useState(false)
  // Captured on open, not read during render (`react-hooks/refs`), same as the Style popover.
  const [bounds, setBounds] = useState<HTMLElement | null>(null)
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setBounds(boundsRef.current) }}>
      <Tooltip side="top" label={label}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
          >
            <Icon size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          alignOffset={alignOffset}
          sideOffset={6}
          collisionPadding={16}
          collisionBoundary={bounds}
          onClick={(e) => e.stopPropagation()}
          className={`z-[60] ${widthClass} animate-modal-in rounded-control border border-border bg-surface p-4 shadow-xl`}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
