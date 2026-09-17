'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'

/**
 * Small controls a document editor's toolbar and per-block control panels
 * share. Originally block-toolbar-only, moved here (Proposal Layout v2
 * Phase 2, spec 5.3) so the Branding editor and the proposal section
 * editor use the same set instead of drifting into two.
 *
 * @module components/editor/toolbar-primitives
 */

/** A segmented toggle: one pill, one option lit. Options with an icon get a tooltip naming them. */
export function PillToggle<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; icon?: React.ReactNode }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className="inline-flex bg-surface-emphasis rounded-control p-0.5">
      {options.map((opt) => {
        const btn = (
          <button
            key={opt.value}
            type="button"
            // Icon-only options otherwise have no accessible name: the label
            // is only in the tooltip.
            aria-label={opt.icon ? opt.label : undefined}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-body rounded-control cursor-pointer transition ${
              value === opt.value ? 'bg-surface text-text shadow-sm font-medium' : 'text-text-muted hover:text-text'
            }`}
          >
            {opt.icon ?? opt.label}
          </button>
        )
        return opt.icon ? (
          <Tooltip key={opt.value} label={opt.label}>{btn}</Tooltip>
        ) : btn
      })}
    </div>
  )
}

/**
 * Non-interactive label naming the sub-element the style controls are acting on
 * (the one clicked in the preview). Replaces the per-block target switchers:
 * selection happens by clicking in the preview, this just says what's selected.
 */

/** Names the sub-element the style controls currently target (set by clicking it in the preview). */
export function ActiveTargetLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center h-8 px-2.5 rounded-control bg-surface-emphasis text-body font-medium text-text whitespace-nowrap shrink-0">
      {label}
    </span>
  )
}

/** A box with a bar at the top, middle or bottom: the vertical-alignment glyph. */
export function VAlignIcon({ position }: { position: 'top' | 'middle' | 'bottom' }) {
  const lineY = position === 'top' ? 4 : position === 'middle' ? 6 : 8
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x="3.5" y={lineY} width="7" height="2" rx="0.75" fill="currentColor" />
    </svg>
  )
}

/** The thin vertical rule between groups of toolbar controls. */
export function ToolbarDivider() {
  return <span className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
}

/** One row of an {@link IncludeDropdown}: a named part and whether it shows. */
export interface IncludeRow {
  label: string
  active: boolean
  set: (v: boolean) => void
}

/**
 * The toolbar's "Include ▾" button: a checkbox list of the parts a block can
 * show or hide (the title's meta rows, the footer's lines, the hero's heading
 * and subheading). One place for visibility keeps the toolbar row narrow and
 * every block's show/hide reading the same.
 */
export function IncludeDropdown({ rows, tooltip = 'Show or hide parts' }: { rows: IncludeRow[]; tooltip?: string }) {
  return (
    <Popover.Root>
      <Tooltip label={tooltip}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-control text-body hover:bg-surface-emphasis cursor-pointer border border-border text-gray-700 shrink-0"
          >
            <span className="text-text font-medium">Include</span>
            <ChevronDown size={10} strokeWidth={2} className="text-text-subtle" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-surface border border-border rounded-control shadow-xl p-2 z-[60] w-[200px] animate-modal-in"
        >
          {rows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => row.set(!row.active)}
              aria-pressed={row.active}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-control text-body text-gray-700 hover:bg-surface-emphasis cursor-pointer"
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-control border shrink-0 ${
                  row.active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-surface border-border-strong text-transparent'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span>{row.label}</span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
