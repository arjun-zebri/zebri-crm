/**
 * Custom React Flow node renderers.
 *
 * One unified component keyed by `data.kind`:
 *
 *   - `trigger`     pseudo-node at the top of every canvas
 *   - `add_action`  dashed "+ Add action" placeholder
 *   - `action`      send_email / create_task / send_quote / …
 *   - `wait`        sleep block
 *   - `branch`      if / else (two output handles, Yes / No)
 *   - `stop`        terminal
 *   - `approval`    pause-for-approval gate
 *
 * Style matches the rest of Zebri: white surface, subtle border,
 * mono Lucide icon in `text-text-muted`, no colour-tinted icon
 * containers. The title line carries the human-readable name
 * (e.g. "Send email", "New enquiry"), the subtitle line carries
 * the description or summary in muted text.
 *
 * @module app/(dashboard)/automations/[id]/canvas-node
 */
'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock, GitBranch, Pause, Plus, Sparkles, Square, type LucideIcon } from 'lucide-react'

import { actionUi } from '@/lib/automations/actions/ui'
import { triggerRegistry } from '@/lib/automations/triggers'
import type { ActionType, AutomationActionRow, TriggerType } from '@/types/automations'

import { getLucideIcon } from './lucide-lookup'

export type CanvasNodeKind =
  | 'trigger'
  | 'action'
  | 'wait'
  | 'branch'
  | 'stop'
  | 'approval'
  | 'add_action'

export interface CanvasNodeData extends Record<string, unknown> {
  kind: CanvasNodeKind
  action: AutomationActionRow | null
  triggerType?: TriggerType | 'unset'
  triggerConfig?: Record<string, unknown>
}

export function CanvasNode({ data, selected }: NodeProps) {
  const d = data as unknown as CanvasNodeData

  if (d.kind === 'add_action') return <AddActionPlaceholder />
  if (d.kind === 'trigger') {
    return (
      <TriggerNodeCard
        triggerType={d.triggerType ?? 'unset'}
        selected={selected ?? false}
      />
    )
  }

  const action = d.action
  if (!action) return null
  return <ActionNodeCard action={action} selected={selected ?? false} />
}

/* ─── Trigger card ────────────────────────────────────────────── */

function TriggerNodeCard({
  triggerType,
  selected,
}: {
  triggerType: TriggerType | 'unset'
  selected: boolean
}) {
  if (triggerType === 'unset') {
    return (
      <div className="w-[260px] relative">
        <div className="text-[10px] uppercase tracking-wide text-text-subtle text-center mb-2">
          Trigger
        </div>
        <div className="flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl border border-dashed border-border bg-surface text-text-muted hover:text-text hover:border-border-strong hover:bg-surface-muted transition cursor-pointer">
          <div className="flex items-center gap-2">
            <Plus size={18} strokeWidth={1.5} />
            <span className="text-sm font-medium">Add trigger</span>
          </div>
          <span className="text-xs text-text-subtle leading-tight text-center">
            Choose what starts this automation
          </span>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          style={handleStyle}
        />
      </div>
    )
  }
  const spec = triggerRegistry[triggerType]
  const Icon = getLucideIcon(spec?.ui.icon)
  return (
    <div className="w-[260px] relative">
      <div className="text-[10px] uppercase tracking-wide text-text-subtle text-center mb-2">
        Trigger
      </div>
      <TriggerShell selected={selected}>
        <TriggerRow
          icon={Icon}
          title={spec?.ui.label ?? triggerType}
          subtitle={spec?.ui.description ?? 'Trigger'}
        />
        <Handle type="source" position={Position.Bottom} id="default" style={handleStyle} />
      </TriggerShell>
    </div>
  )
}

function TriggerShell({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const ringClass = selected
    ? 'border-brand shadow-sm'
    : 'border-border hover:border-border-strong'
  return (
    <div className={`bg-surface rounded-xl border ${ringClass} relative transition`}>
      {children}
    </div>
  )
}

function TriggerRow({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <Icon size={18} strokeWidth={1.5} className="text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-xs text-text-muted line-clamp-2">{subtitle}</div>}
      </div>
    </div>
  )
}

/* ─── Action card ────────────────────────────────────────────── */

function ActionNodeCard({ action, selected }: { action: AutomationActionRow; selected: boolean }) {
  const meta = actionMeta(action)
  const isBranch = action.type === 'branch'

  return (
    <NodeShell
      selected={selected}
      topHandle
      bottomHandle={!isBranch}
      bottomHandleId="default"
    >
      <NodeRow icon={meta.icon} title={meta.title} subtitle={meta.subtitle} />
      {isBranch && (
        <>
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-text-subtle px-4 pb-2">
            <span>Yes</span>
            <span>No</span>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ ...handleStyle, left: 32 }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ ...handleStyle, left: 'calc(100% - 32px)' }}
          />
        </>
      )}
    </NodeShell>
  )
}

interface ActionMeta {
  icon: LucideIcon
  title: string
  subtitle: string
}

function actionMeta(action: AutomationActionRow): ActionMeta {
  switch (action.type) {
    case 'wait':
      return { icon: Clock, title: 'Wait', subtitle: waitSummary(action.config as never) }
    case 'branch':
      return { icon: GitBranch, title: 'Branch', subtitle: 'If / else split' }
    case 'stop':
      return { icon: Square, title: 'Stop', subtitle: 'End the run here' }
    case 'approval':
      return { icon: Pause, title: 'Wait for approval', subtitle: 'Pause until you confirm' }
    case 'sub_flow':
      return { icon: Sparkles, title: 'Run automation', subtitle: 'Trigger another automation' }
    default: {
      // For registered actions, look up the client-safe UI catalogue.
      const ui = actionUi[action.type as ActionType]
      return {
        icon: getLucideIcon(ui?.icon),
        title: ui?.label ?? 'Action',
        subtitle: ui?.description ?? '',
      }
    }
  }
}

function waitSummary(c: Record<string, unknown>): string {
  const mode = c['mode'] as string | undefined
  if (mode === 'duration') {
    const d = (c['durationMinutes'] as number) ?? 0
    if (d >= 1440) return `Wait ${Math.round(d / 1440)} days`
    if (d >= 60) return `Wait ${Math.round(d / 60)} hours`
    return `Wait ${d} minutes`
  }
  if (mode === 'relative_to_event') {
    const r = c['relative'] as { amount?: number; unit?: string; direction?: string } | undefined
    if (r) return `${r.amount} ${r.unit} ${r.direction} the event`
  }
  if (mode === 'until_date') return 'Wait until a date'
  return 'Pause before the next action'
}

/* ─── Add-action placeholder ────────────────────────────────────── */

function AddActionPlaceholder() {
  return (
    <div className="w-[240px] relative">
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1, top: -1 }}
      />
      <div className="flex items-center gap-2 justify-center px-3 py-3 rounded-xl border border-dashed border-border bg-surface text-text-muted hover:text-text hover:border-border-strong transition cursor-pointer">
        <Plus size={14} strokeWidth={1.5} />
        <span className="text-sm">Add action</span>
      </div>
    </div>
  )
}

/* ─── Shared shell + row primitives ───────────────────────────── */

const handleStyle: React.CSSProperties = {
  background: 'var(--color-border)',
  width: 6,
  height: 6,
  border: 'none',
}

function NodeShell({
  selected,
  topHandle,
  bottomHandle,
  bottomHandleId,
  children,
}: {
  selected: boolean
  topHandle: boolean
  bottomHandle: boolean
  bottomHandleId: string
  children: React.ReactNode
}) {
  const ringClass = selected ? 'border-brand shadow-sm' : 'border-border hover:border-border-strong'
  return (
    <div className={`bg-surface rounded-xl border ${ringClass} w-[240px] relative transition`}>
      {topHandle && <Handle type="target" position={Position.Top} style={handleStyle} />}
      {children}
      {bottomHandle && (
        <Handle type="source" position={Position.Bottom} id={bottomHandleId} style={handleStyle} />
      )}
    </div>
  )
}

function NodeRow({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon size={16} strokeWidth={1.5} className="text-text-muted shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && <div className="text-xs text-text-muted truncate">{subtitle}</div>}
      </div>
    </div>
  )
}
