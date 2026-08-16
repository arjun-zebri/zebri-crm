/**
 * Canvas node: one step, expandable in place.
 *
 * The card is the editor. Clicking it grows the node to hold the
 * step's own config (filter chips for a trigger, the action form for
 * everything else) rather than opening a side rail, so the settings
 * sit on the thing they belong to. React Flow measures the node after
 * it grows and re-routes the connector lines, so the flow stays wired
 * while a step is open.
 *
 * Handlers and the body renderer arrive through {@link FlowNodeContext}
 * rather than through node `data`: React Flow re-creates the node array
 * on every change, and passing React elements through it would rebuild
 * the whole form on each keystroke.
 *
 * @module app/(dashboard)/automations/[id]/flow-node
 */
'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, Plus, Repeat2, Trash2 } from 'lucide-react'
import { createElement, createContext, useContext } from 'react'

import { getLucideIcon } from './lucide-lookup'

/** Node width. Wide enough for a subject line, narrow enough to scan. */
const NODE_WIDTH = 'w-[380px]'

export type FlowNodeKind = 'trigger' | 'action' | 'branch' | 'add' | 'trigger_empty'

export interface FlowNodeData extends Record<string, unknown> {
  kind: FlowNodeKind
  /** Row id, or a sentinel for the trigger / add placeholders. */
  nodeId: string
  title: string
  summary: string
  /** Lucide icon name from the trigger / action UI catalogue. */
  iconName?: string | undefined
  /**
   * The step configures itself in a modal (`send_email`), so the card
   * has no inline body: clicking it opens the modal and there is no
   * expand chevron to offer.
   */
  modalOnly?: boolean | undefined
  /**
   * The step has nothing to configure at all (`stop`). No chevron, no
   * panel, and the card does not respond to a click — an expand that
   * opens onto nothing is a promise the card cannot keep.
   */
  noConfig?: boolean | undefined
}

export interface FlowNodeApi {
  expandedId: string | null
  onToggle: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onChangeTrigger: (e: React.MouseEvent) => void
  /** The step's config form. Called only while the node is expanded. */
  renderBody: (nodeId: string) => React.ReactNode
}

export const FlowNodeContext = createContext<FlowNodeApi | null>(null)

const handleStyle: React.CSSProperties = {
  background: 'var(--color-border)',
  width: 6,
  height: 6,
  border: 'none',
}

export function FlowNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowNodeData
  const api = useContext(FlowNodeContext)

  if (d.kind === 'add') return <AddPlaceholder label={d.title} />
  if (d.kind === 'trigger_empty') return <TriggerPlaceholder label={d.title} summary={d.summary} />

  const expanded = api?.expandedId === d.nodeId
  const isTrigger = d.kind === 'trigger'
  const isBranch = d.kind === 'branch'

  return (
    <div className={NODE_WIDTH}>
      {isTrigger && (
        <div className="mb-2 text-center text-body uppercase tracking-wide text-text-subtle">
          Trigger
        </div>
      )}

      <div
        className={`rounded-control bg-card transition-colors ${
          expanded || selected
            ? 'border border-border-strong shadow-lg'
            : 'border border-border shadow-sm'
        }`}
      >
        {!isTrigger && <Handle type="target" position={Position.Top} style={handleStyle} />}

        <div className="flex items-center gap-3 px-3 py-3">
          <button
            type="button"
            {...(d.noConfig ? { disabled: true } : { onClick: () => api?.onToggle(d.nodeId) })}
            {...(d.modalOnly || d.noConfig ? {} : { 'aria-expanded': expanded })}
            className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
              d.noConfig ? '' : 'cursor-pointer'
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${
                isTrigger ? 'bg-brand-bg text-brand-fg' : 'bg-surface-muted text-text-muted'
              }`}
            >
              {/* createElement rather than `const Icon = …; <Icon/>`:
                  the latter reads to the React Compiler lint as
                  building a component during render, though this is
                  only a lookup in a static map. */}
              {createElement(getLucideIcon(d.iconName), { size: 16, strokeWidth: 1.5 })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-text">{d.title}</span>
              <span className="block truncate text-body text-text-muted">{d.summary}</span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            {isTrigger && (
              <button
                type="button"
                onClick={(e) => api?.onChangeTrigger(e)}
                className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-text"
                aria-label="Change trigger"
                title="Change trigger"
              >
                <Repeat2 size={15} strokeWidth={1.5} />
              </button>
            )}
            {!isTrigger && (
              <button
                type="button"
                onClick={() => api?.onDelete(d.nodeId)}
                className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-danger"
                aria-label={`Delete ${d.title} step`}
              >
                <Trash2 size={15} strokeWidth={1.5} />
              </button>
            )}
            {!d.modalOnly && !d.noConfig && (
              <button
                type="button"
                onClick={() => api?.onToggle(d.nodeId)}
                aria-label={expanded ? `Collapse ${d.title}` : `Expand ${d.title}`}
                className="cursor-pointer p-1 text-text-subtle transition-colors hover:text-text"
              >
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Height animates via grid-template-rows 0fr→1fr, which tweens
            to the body's natural height in a way a max-height guess
            cannot. The wrapper is always present so the transition has
            something to run on; the body inside is mounted lazily by
            the page, the first time this node is opened.

            `nodrag` / `nowheel` keep the canvas still while the form is
            in use: without them a drag inside a text field pans the
            node, and scrolling a long form zooms the canvas. */}
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            expanded && !d.modalOnly && !d.noConfig ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`nodrag nowheel ${
                d.modalOnly || d.noConfig ? '' : 'border-t border-border px-3 py-3'
              }`}
            >
              {api?.renderBody(d.nodeId)}
            </div>
          </div>
        </div>

        {isBranch ? (
          <>
            <Handle
              type="source"
              position={Position.Bottom}
              id="yes"
              style={{ ...handleStyle, left: '30%' }}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="no"
              style={{ ...handleStyle, left: '70%' }}
            />
          </>
        ) : (
          <Handle type="source" position={Position.Bottom} id="default" style={handleStyle} />
        )}
      </div>
    </div>
  )
}

function AddPlaceholder({ label }: { label: string }) {
  return (
    <div className={NODE_WIDTH}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div className="flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-dashed border-border bg-card px-4 py-4 text-body text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-text">
        <Plus size={14} strokeWidth={1.5} />
        {label}
      </div>
    </div>
  )
}

function TriggerPlaceholder({ label, summary }: { label: string; summary: string }) {
  return (
    <div className={NODE_WIDTH}>
      <div className="mb-2 text-center text-body uppercase tracking-wide text-text-subtle">
        Trigger
      </div>
      <div className="flex cursor-pointer flex-col items-center gap-1 rounded-control border border-dashed border-border bg-card px-4 py-6 text-text-muted transition-colors hover:border-border-strong hover:text-text">
        <span className="flex items-center gap-2 text-body font-medium">
          <Plus size={16} strokeWidth={1.5} />
          {label}
        </span>
        <span className="text-body text-text-subtle">{summary}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="default" style={handleStyle} />
    </div>
  )
}
