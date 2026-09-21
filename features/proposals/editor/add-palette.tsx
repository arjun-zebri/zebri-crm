'use client'

/**
 * The add-section palette (Task 8): a `LibraryItemCard` grid of the
 * seven `SectionKind`s (via `newSectionFor`), rendered by
 * `palette-body.tsx`'s `PaletteBody`. `SectionCanvas` mounts one
 * instance and drives it from `useAddPalette` (`use-add-palette.ts`):
 * opened from a hover "+" line it renders as a Radix Popover anchored to
 * that line; opened from the trailing "Add section" button (no anchor
 * element to pop from) it renders as a `Modal` instead.
 *
 * The Modal branch renders `PaletteBody` bare, not wrapped in `MenuPanel`
 * (final review Finding 4): `Modal` already draws its own
 * `bg-surface rounded-control border border-border`, and `MenuPanel`
 * independently owns the same border/background/shadow - nesting them
 * drew a border inside a border, the box-in-box the design system
 * forbids. It also renders with no `overflow`/`max-h` classes of its own:
 * `Modal`'s own body wrapper is already the scroll container (it carries
 * `overflow-y-auto` plus the `px-4 sm:px-6` inset), so a second
 * `overflow-y-auto` here nested one level deeper than that padding put
 * the scrollbar on the *inner* div's edge - visibly inset from the
 * modal's true right edge - instead of on the modal panel's own edge.
 * The Popover branch still wraps `PaletteBody` in `MenuPanel`, since a
 * Radix `Popover.Content` carries no chrome of its own.
 *
 * Presentation only: it never dispatches. `onAdd` hands the caller a
 * freshly-built `Section`; `SectionCanvas`'s `useAddPalette` is what
 * turns that into an `addSection` dispatch.
 *
 * @module features/proposals/editor/add-palette
 */
import * as Popover from '@radix-ui/react-popover'

import { MenuPanel } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { ProposalRole } from '@/lib/proposals/types'

import type { Section } from '../model/layout'

import { PaletteBody } from './palette-body'

/** Props for {@link AddPalette}. */
export interface AddPaletteProps {
  open: boolean
  /** Layout index the chosen section is inserted at; `null` while closed. */
  at: number | null
  onOpenChange: (open: boolean) => void
  onAdd: (section: Section, at: number) => void
  /** Flavours preset copy (`presetSection`'s `role` param) and the about/how-it-works section starters. */
  role: ProposalRole
  /** Fed straight to `PaletteBody`'s card grid, whose thumbnails render the real branded layout. */
  branding: PublicBranding
  /** Disables every card once the layout is at `LAYOUT_LIMITS.maxSections`. Defaults to false for a caller that doesn't track the cap. */
  atCap?: boolean
  /** The add line's own element, when opened from a hover "+" line. Renders a `Modal` instead of a Popover when absent (the trailing "Add section" button's path). */
  anchor?: HTMLElement | null
}

/** Two-tab section/preset card grid for one pending insert index. Popover when `anchor` is set, `Modal` otherwise. */
export function AddPalette({ open, at, onOpenChange, onAdd, role, branding, atCap, anchor }: AddPaletteProps) {
  const choose = (section: Section) => {
    if (at === null) return
    onAdd(section, at)
  }

  const body = <PaletteBody role={role} branding={branding} {...(atCap !== undefined ? { atCap } : {})} onChoose={choose} />

  if (anchor) {
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor virtualRef={{ current: anchor }} />
        <Popover.Portal>
          <Popover.Content align="center" sideOffset={6} className="z-[70] animate-modal-in">
            {/* Positioning/stacking/animation only: `MenuPanel` below owns
                the panel's own width, border, background and shadow, same
                split as `components/ui/rich-text-list-style-menu.tsx`.
                `lg` (288px) fits the card grid's two columns; the
                taller `max-h` (up from the old text list's 320px) gives the
                thumbnail grid room before it needs to scroll. */}
            <MenuPanel width="lg" className="max-h-[28rem] overflow-y-auto">
              {/* `PaletteBody` itself carries no horizontal padding (so its
                  card grid lines up with the Modal branch's title) -
                  `MenuPanel` doesn't add any of its own either, so this
                  popover-only wrapper supplies the inset from the panel's
                  edge instead. `px-3` matches `MenuItem`'s own row inset
                  rather than the tighter `px-1` a two-column card grid
                  needs a step spacier than a text menu row. */}
              <div className="px-3">{body}</div>
            </MenuPanel>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title="Add a section" size="sm">
      {/* Bare, not wrapped in `MenuPanel`: `Modal` already supplies the
          surface, border and padding a dropdown menu would otherwise need
          `MenuPanel` for. `role="menu"` keeps the same a11y shape as the
          Popover branch's `MenuPanel` without redrawing its chrome. No
          `overflow`/`max-h` here: `Modal`'s own body wrapper is already
          the scroll container, right at the panel's true edge - a second
          one here would only push the scrollbar in behind that div's own
          padding again (see the module doc). */}
      <div role="menu">{body}</div>
    </Modal>
  )
}
