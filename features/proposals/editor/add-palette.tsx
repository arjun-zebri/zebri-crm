'use client'

/**
 * The add-section palette (Task 8): two tabs, Sections (the seven
 * `SectionKind`s via `newSectionFor`) and Presets (the seven `PresetId`s
 * via `presetSection`), rendered by `palette-body.tsx`'s `PaletteBody`.
 * `SectionCanvas` mounts one instance and drives it from `useAddPalette`
 * (`use-add-palette.ts`): opened from a hover "+" line it renders as a
 * Radix Popover anchored to that line; opened from the trailing "Add
 * section" button (no anchor element to pop from) it renders as a `Modal`
 * instead.
 *
 * The Modal branch renders `PaletteBody` bare, not wrapped in `MenuPanel`
 * (final review Finding 4): `Modal` already draws its own
 * `bg-surface rounded-control border border-border`, and `MenuPanel`
 * independently owns the same border/background/shadow - nesting them
 * drew a border inside a border, the box-in-box the design system
 * forbids. The Popover branch still wraps `PaletteBody` in `MenuPanel`,
 * since a Radix `Popover.Content` carries no chrome of its own.
 *
 * Presentation only: it never dispatches. `onAdd` hands the caller a
 * freshly-built `Section`; `SectionCanvas`'s `useAddPalette` is what
 * turns that into an `addSection` dispatch.
 *
 * @module features/proposals/editor/add-palette
 */
import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'

import { MenuPanel } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import type { ProposalRole } from '@/lib/proposals/types'

import type { Section } from '../model/layout'

import { PaletteBody, type PaletteTab } from './palette-body'

/** Props for {@link AddPalette}. */
export interface AddPaletteProps {
  open: boolean
  /** Layout index the chosen section is inserted at; `null` while closed. */
  at: number | null
  onOpenChange: (open: boolean) => void
  onAdd: (section: Section, at: number) => void
  /** Flavours preset copy (`presetSection`'s `role` param) and the about/how-it-works section starters. */
  role: ProposalRole
  /** The add line's own element, when opened from a hover "+" line. Renders a `Modal` instead of a Popover when absent (the trailing "Add section" button's path). */
  anchor?: HTMLElement | null
}

/** Two-tab section/preset list for one pending insert index. Popover when `anchor` is set, `Modal` otherwise. */
export function AddPalette({ open, at, onOpenChange, onAdd, role, anchor }: AddPaletteProps) {
  const [tab, setTab] = useState<PaletteTab>('sections')
  // Always opens on Sections: a palette left on Presets from a previous
  // insert would otherwise silently carry that choice into the next one,
  // at a different index, which reads as the palette "remembering" the
  // wrong tab rather than starting fresh each time it opens. Adjusted
  // during render (mirroring `components/ui/modal.tsx`'s own `open`-edge
  // latch), not in an effect: an effect's `setState` would still commit
  // the old tab's first paint before flipping, and the ratcheted
  // `react-hooks/set-state-in-effect` lint disallows it outright.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab('sections')
  }

  const choose = (section: Section) => {
    if (at === null) return
    onAdd(section, at)
  }

  const body = <PaletteBody tab={tab} onTabChange={setTab} role={role} onChoose={choose} />

  if (anchor) {
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor virtualRef={{ current: anchor }} />
        <Popover.Portal>
          <Popover.Content align="center" sideOffset={6} className="z-[70] animate-modal-in">
            {/* Positioning/stacking/animation only: `MenuPanel` below owns
                the panel's own width, border, background and shadow, same
                split as `components/ui/rich-text-list-style-menu.tsx`. */}
            <MenuPanel width="lg" className="max-h-80 overflow-y-auto">{body}</MenuPanel>
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
          Popover branch's `MenuPanel` without redrawing its chrome. */}
      <div role="menu" className="max-h-80 overflow-y-auto">{body}</div>
    </Modal>
  )
}
