/**
 * Table-style list of automations - matches the couples-list aesthetic.
 *
 * Real HTML `<table>` (no card-bordered wrapper around it), sticky
 * `<thead>` with icon-prefixed column labels (`text-body font-normal
 * text-text-subtle`), rows separated by `border-b border-gray-100`,
 * subtle `hover:bg-gray-50/60` row highlight.
 *
 * Skeleton rows match the couples loading pattern (`animate-pulse`
 * + `h-4 bg-surface-emphasis rounded-control`).
 *
 * @module app/(dashboard)/automations/automations-table
 */
'use client'

import {
  ArrowRight,
  Clock,
  MoreHorizontal,
  Percent,
  PlayCircle,
  Workflow,
} from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Toggle } from '@/components/ui/toggle'
import type {
  AutomationStatus,
  EnrichedAutomationRow,
} from '@/types/automations'

import { deleteAutomationAction, setAutomationStatusAction } from './actions'
import { relativeFuture, relativePast } from './relative-time'

interface Props {
  automations: EnrichedAutomationRow[]
  loading?: boolean
  onOpen: (id: string) => void
  onChange: () => void
}

/** Per-column width percentages, summing to 100. Matches the
 *  pattern used by `couples-list-columns.tsx`. */
const COL_WIDTHS: Record<string, string> = {
  on: '8%',
  name: '24%',
  trigger: '18%',
  runs: '8%',
  success: '12%',
  last: '14%',
  next: '14%',
  more: '2%',
}

const SKELETON_WIDTHS = [
  'w-7',
  'w-40',
  'w-28',
  'w-6',
  'w-10',
  'w-14',
  'w-14',
  'w-4',
]

export function AutomationsTable({ automations, loading, onOpen, onChange }: Props) {
  return (
    <div className="relative">
      <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[800px] select-none">
        <thead className="sticky top-0 bg-surface z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
          <tr>
            <Th id="on" textOnly="On" />
            <Th id="name" textOnly="Aa" label="Name" />
            <Th id="trigger" icon={<Workflow size={11} strokeWidth={1.5} />} label="Trigger" />
            <Th id="runs" icon={<PlayCircle size={11} strokeWidth={1.5} />} label="Runs" />
            <Th
              id="success"
              icon={<Percent size={11} strokeWidth={1.5} />}
              label="Success"
            />
            <Th id="last" icon={<Clock size={11} strokeWidth={1.5} />} label="Last fired" />
            <Th id="next" icon={<ArrowRight size={11} strokeWidth={1.5} />} label="Next fire" />
            <Th id="more" />
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {SKELETON_WIDTHS.map((w, j) => (
                    <td key={j} className="pl-0 pr-2 py-2 border-b border-gray-100">
                      <div className={`h-4 bg-surface-emphasis rounded-control ${w}`} />
                    </td>
                  ))}
                </tr>
              ))
            : automations.map((a, idx) => (
                <Row
                  key={a.id}
                  automation={a}
                  isLast={idx === automations.length - 1}
                  onOpen={onOpen}
                  onChange={onChange}
                />
              ))}
        </tbody>
      </table>

      {/* Mobile: stacked rows */}
      <div className="sm:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-b border-gray-100 px-1 py-3 animate-pulse space-y-2"
              >
                <div className="h-4 w-40 bg-surface-emphasis rounded-control" />
                <div className="h-3 w-24 bg-surface-emphasis rounded-control" />
              </div>
            ))
          : automations.map((a) => <MobileRow key={a.id} automation={a} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

/* ─── Header cell ─────────────────────────────────────────────── */

function Th({
  id,
  icon,
  textOnly,
  label,
}: {
  id: string
  icon?: React.ReactNode
  textOnly?: string
  label?: string
}) {
  return (
    <th
      className="pl-0 pr-2 py-1.5 text-left text-body font-normal text-text-subtle"
      style={{ width: COL_WIDTHS[id] }}
    >
      <span className="flex items-center gap-1.5">
        {textOnly ? <span className="text-[11px]">{textOnly}</span> : icon}
        {label}
      </span>
    </th>
  )
}

/* ─── Row ─────────────────────────────────────────────────────── */

function Row({
  automation,
  isLast,
  onOpen,
  onChange,
}: {
  automation: EnrichedAutomationRow
  isLast: boolean
  onOpen: (id: string) => void
  onChange: () => void
}) {
  const a = automation
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const borderClass = isLast ? '' : 'border-b border-gray-100'

  async function toggle() {
    const next: AutomationStatus = a.status === 'active' ? 'paused' : 'active'
    await setAutomationStatusAction({ automationId: a.id, status: next })
    onChange()
  }

  function remove(e: React.MouseEvent) {
    // Open the confirm modal instead of firing the destructive delete
    // straight from the menu - native confirm() is banned by the
    // design system, so we route through the shared ConfirmDialog.
    e.stopPropagation()
    setMenuOpen(false)
    setConfirmOpen(true)
  }

  async function confirmRemove() {
    setDeleting(true)
    await deleteAutomationAction({ automationId: a.id })
    setDeleting(false)
    setConfirmOpen(false)
    onChange()
  }

  return (
    <tr
      onClick={() => onOpen(a.id)}
      className="cursor-pointer transition group hover:bg-gray-50/60"
    >
      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        {/* The row itself opens the automation, so the switch has to stop the
            click before it bubbles or flipping one would also open it. */}
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Toggle
            checked={a.status === 'active'}
            onChange={toggle}
            ariaLabel={`${a.status === 'active' ? 'Pause' : 'Activate'} ${a.name}`}
          />
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-body text-text-muted group-hover:text-text truncate block">
          {a.name}
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-body text-text-muted truncate block">{a.triggerLabel}</span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-body text-text-muted">{a.runCount}</span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <SuccessRate rate={a.successRate} />
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-body text-text-muted">
          {a.lastFiredAt ? relativePast(a.lastFiredAt) : '-'}
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-body text-text-muted">
          {a.nextWakeAt ? relativeFuture(a.nextWakeAt) : '-'}
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 relative ${borderClass}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className="p-1.5 rounded-control text-text-subtle hover:bg-surface-emphasis hover:text-gray-700 opacity-0 group-hover:opacity-100 transition cursor-pointer"
          aria-label="More actions"
        >
          <MoreHorizontal size={14} strokeWidth={1.5} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-1 z-10 w-32 bg-surface border border-border rounded-control shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={remove}
              className="w-full text-left text-body px-3 py-1.5 text-red-600 hover:bg-gray-50 cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}
        <ConfirmDialog
          open={confirmOpen}
          title="Delete automation"
          description="Delete this automation? Any running instances will stop."
          loading={deleting}
          onConfirm={confirmRemove}
          onCancel={() => setConfirmOpen(false)}
        />
      </td>
    </tr>
  )
}

function MobileRow({
  automation,
  onOpen,
}: {
  automation: EnrichedAutomationRow
  onOpen: (id: string) => void
}) {
  const a = automation
  return (
    <button
      type="button"
      onClick={() => onOpen(a.id)}
      className="w-full text-left border-b border-gray-100 px-1 py-3 hover:bg-gray-50/60 cursor-pointer transition"
    >
      <div className="text-body text-text truncate">{a.name}</div>
      <div className="text-body text-text-muted mt-0.5 truncate">
        {a.triggerLabel} · {a.runCount} runs
        {a.lastFiredAt && ` · last ${relativePast(a.lastFiredAt)}`}
      </div>
    </button>
  )
}

/* ─── Toggle switch ───────────────────────────────────────────── */


/* ─── Success-rate cell ───────────────────────────────────────── */

function SuccessRate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-body text-text-subtle">-</span>
  const pct = Math.round(rate * 100)
  const tone =
    pct >= 95
      ? 'text-emerald-600'
      : pct >= 80
        ? 'text-text-muted'
        : 'text-amber-600'
  return <span className={`text-body ${tone}`}>{pct}%</span>
}
