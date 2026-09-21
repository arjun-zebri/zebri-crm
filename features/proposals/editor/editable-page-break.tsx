'use client'

/**
 * A `pageBreak` section's row in the template canvas (`model/pages.ts`):
 * a dashed rule with a "Page break" tag, sortable and selectable like any
 * other section (drag handle, click to select, Delete key through
 * `useCanvasKeys`) plus its own Remove button, since a break has no
 * toolbar: nothing on it to style, duplicate or resize. In stack flow the
 * tag carries a hint that the break only takes effect in "One at a time",
 * so a break left behind by a flow switch never reads as a broken row.
 *
 * @module features/proposals/editor/editable-page-break
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import type { Section } from '../model/layout'
import type { ProposalTheme } from '../model/theme'

import type { LayoutAction } from './state'

/** Shown on the tag while the flow is Stacked, where a break renders nothing on the public page. */
export const PAGE_BREAK_STACK_HINT = 'Only shown in One at a time'

/** Props for {@link EditablePageBreak}. */
export interface EditablePageBreakProps {
  section: Section
  selected: boolean
  /** The layout's canvas theme: the hint shows when `flow` is `stack`. */
  theme: ProposalTheme
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/** One page-break row. See the module doc. */
export function EditablePageBreak({ section, selected, theme, dispatch }: EditablePageBreakProps) {
  // `animateLayoutChanges: () => false` for the same reason as `editable-section.tsx`.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, animateLayoutChanges: () => false })
  const select = () => dispatch({ type: 'select', sectionId: section.id })
  const ringClass = selected ? 'ring-2 ring-brand-fg ring-inset' : 'ring-1 ring-transparent ring-inset hover:ring-brand-fg/40'

  return (
    <div
      ref={setNodeRef}
      data-canvas-section-id={section.id}
      data-section-kind={section.kind}
      onClick={select}
      className={`group relative flex h-10 items-center px-10 ${ringClass}`}
      // `CSS.Translate`, never `CSS.Transform`: see `editable-section.tsx` for why (scale from mismatched row sizes).
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation()
          select()
        }}
        aria-label="Move page break"
        className={`absolute left-1 top-1/2 z-10 -translate-y-1/2 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-control text-text-subtle transition hover:text-text active:cursor-grabbing ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </button>
      <div className="flex-1 border-t border-dashed border-border-strong" />
      <span className="mx-3 flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-surface px-2.5 py-1 text-body text-text-muted shadow-sm">
        Page break
        {theme.flow === 'stack' ? <span className="text-text-subtle">· {PAGE_BREAK_STACK_HINT}</span> : null}
      </span>
      <div className="flex-1 border-t border-dashed border-border-strong" />
      <div className={`absolute right-1 top-1/2 -translate-y-1/2 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <Tooltip side="top" label="Remove page break">
          <Button
            variant="ghost"
            iconOnly
            aria-label="Remove page break"
            // No confirm: a break holds nothing (`isSectionEmpty`), and Undo covers it.
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'deleteSection', id: section.id }, { commit: true })
            }}
          >
            <X size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
