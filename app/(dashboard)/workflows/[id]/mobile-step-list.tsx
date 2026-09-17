'use client'

/**
 * The builder, on a phone.
 *
 * A pan-and-zoom canvas is the wrong shape for a 390px screen: the
 * cards are wider than the viewport, a drag to scroll moves a node
 * instead, and pinch-zoom fights the page. An MC standing at a venue
 * checking what happens next should not have to fight any of that.
 *
 * So below `md` the same steps render as a plain vertical list, in run
 * order, using the same expand-in-place config bodies the canvas cards
 * use. Nothing is read-only and nothing is missing: it is the same
 * builder with the geometry taken out.
 *
 * Steps reorder the same way the canvas does: drag the handle to move a
 * step above or below another one in its own list. `onReorder` only
 * ever fires for a drop within that same list (same parent + branch) -
 * the drag handle here has no way to pick a target from a different one.
 *
 * @module app/(dashboard)/workflows/[id]/mobile-step-list
 */

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Plus, Repeat2, Trash2 } from 'lucide-react'
import { createElement } from 'react'

import type { BranchPath } from '@/types/automations'

import type { FlowNodeApi, FlowNodeData } from './flow-node'
import { getLucideIcon } from './lucide-lookup'

/** One row of the list: a card plus where it sits in the branch tree. */
export interface MobileStepItem {
  data: FlowNodeData
  /** 0 for the main line, 1+ inside a branch. */
  depth: number
  /** "Yes" / "No", on the first step of a branch leg only. */
  branchLabel?: string | undefined
  /** The sibling list this step reorders within: same parent + branch. */
  parentStepId: string | null
  branchPath: BranchPath | null
}

export interface MobileStepListProps {
  items: MobileStepItem[]
  api: FlowNodeApi
  /** Whether the "Add step" row shows (hidden until a start rule is set). */
  canAdd: boolean
  /** Adds to the end of the main line; the event anchors the picker. */
  onAdd: (e: React.MouseEvent) => void
  /** A step's drag handle was dropped onto another step's row. */
  onReorder: (movingId: string, overId: string) => void
}

/** The phone-width builder list. See {@link MobileStepListProps}. */
export function MobileStepList({ items, api, canAdd, onAdd, onReorder }: MobileStepListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(String(active.id), String(over.id))
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.data.nodeId)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {items.map((item) => (
              <li
                key={item.data.nodeId}
                style={{ paddingLeft: `${item.depth * 16}px` }}
              >
                {item.branchLabel ? (
                  <p className="mb-1 text-body text-text-subtle">{item.branchLabel}</p>
                ) : null}
                <StepCard item={item} api={api} />
              </li>
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-border px-3 py-3 text-body text-text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          <Plus size={16} strokeWidth={1.5} />
          Add step
        </button>
      ) : null}
    </div>
  )
}

/** One card. Mirrors the canvas node, minus the connector handles. */
function StepCard({ item, api }: { item: MobileStepItem; api: FlowNodeApi }) {
  const d = item.data
  const isTrigger = d.kind === 'trigger' || d.kind === 'trigger_empty'
  const expanded = api.expandedId === d.nodeId
  const configurable = !d.modalOnly && !d.noConfig

  // The trigger doesn't reorder: it isn't a sibling any drag could land on.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: d.nodeId,
    disabled: isTrigger,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-control bg-card ${
        isDragging ? 'opacity-50' : ''
      } ${expanded ? 'border border-border-strong shadow-lg' : 'border border-border shadow-sm'}`}
    >
      <div className="flex items-center gap-3 px-3 py-3">
        {!isTrigger ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none p-1 text-text-subtle active:cursor-grabbing"
            aria-label={`Drag to reorder ${d.title}`}
          >
            <GripVertical size={15} strokeWidth={1.5} />
          </button>
        ) : null}
        <button
          type="button"
          {...(d.noConfig ? { disabled: true } : { onClick: () => api.onToggle(d.nodeId) })}
          {...(configurable ? { 'aria-expanded': expanded } : {})}
          className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
            d.noConfig ? '' : 'cursor-pointer'
          }`}
        >
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${
              isTrigger ? 'bg-brand-bg text-brand-fg' : 'bg-surface-muted text-text-muted'
            }`}
          >
            {createElement(getLucideIcon(d.iconName), { size: 16, strokeWidth: 1.5 })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-text">{d.title}</span>
            <span className="block text-body text-text-muted">{d.summary}</span>
            {d.timingLabel || d.needsReview ? (
              <span className="mt-1 flex flex-wrap items-center gap-1">
                {d.timingLabel ? (
                  <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-body text-text-muted">
                    {d.timingLabel}
                  </span>
                ) : null}
                {d.needsReview ? (
                  <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-body text-text-muted">
                    Asks you first
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {isTrigger ? (
            <button
              type="button"
              onClick={(e) => api.onChangeTrigger(e)}
              className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-text"
              aria-label="Change when this applies"
            >
              <Repeat2 size={15} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => api.onDelete(d.nodeId)}
              className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-danger"
              aria-label={`Delete ${d.title} step`}
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )}
          {configurable ? (
            <button
              type="button"
              onClick={() => api.onToggle(d.nodeId)}
              aria-label={expanded ? `Collapse ${d.title}` : `Expand ${d.title}`}
              className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-text"
            >
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </div>
      </div>

      {/* Always mounted, like the canvas card: a modal-only step
          (an email) renders its modal from in here, so skipping the
          body when the card is collapsed would mean clicking it opened
          nothing. The grid rows tween the inline forms open. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded && configurable ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={configurable ? 'border-t border-border px-3 py-3' : ''}>
            {api.renderBody(d.nodeId)}
          </div>
        </div>
      </div>
    </div>
  )
}
