/**
 * Table-style list of automations - matches the couples-list aesthetic.
 *
 * Real HTML `<table>` (no card-bordered wrapper around it), sticky
 * `<thead>` with icon-prefixed column labels (`text-xs font-normal
 * text-gray-400`), rows separated by `border-b border-gray-100`,
 * subtle `hover:bg-gray-50/60` row highlight.
 *
 * Skeleton rows match the couples loading pattern (`animate-pulse`
 * + `h-4 bg-gray-100 rounded-md`).
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
        <thead className="sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
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
                      <div className={`h-4 bg-gray-100 rounded-md ${w}`} />
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
                <div className="h-4 w-40 bg-gray-100 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
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
      className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400"
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
  const borderClass = isLast ? '' : 'border-b border-gray-100'

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    const next: AutomationStatus = a.status === 'active' ? 'paused' : 'active'
    await setAutomationStatusAction({ automationId: a.id, status: next })
    onChange()
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!confirm('Delete this automation? Any running instances will stop.')) return
    await deleteAutomationAction({ automationId: a.id })
    onChange()
  }

  return (
    <tr
      onClick={() => onOpen(a.id)}
      className="cursor-pointer transition group hover:bg-gray-50/60"
    >
      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <ToggleSwitch checked={a.status === 'active'} onClick={toggle} />
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {a.name}
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-sm text-gray-500 truncate block">{a.triggerLabel}</span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-sm text-gray-500">{a.runCount}</span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <SuccessRate rate={a.successRate} />
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-xs text-gray-500">
          {a.lastFiredAt ? relativePast(a.lastFiredAt) : '-'}
        </span>
      </td>

      <td className={`pl-0 pr-2 py-2.5 ${borderClass}`}>
        <span className="text-xs text-gray-500">
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
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition cursor-pointer"
          aria-label="More actions"
        >
          <MoreHorizontal size={14} strokeWidth={1.5} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-1 z-10 w-32 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={remove}
              className="w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-gray-50 cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}
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
      <div className="text-sm text-gray-900 truncate">{a.name}</div>
      <div className="text-xs text-gray-500 mt-0.5 truncate">
        {a.triggerLabel} · {a.runCount} runs
        {a.lastFiredAt && ` · last ${relativePast(a.lastFiredAt)}`}
      </div>
    </button>
  )
}

/* ─── Toggle switch ───────────────────────────────────────────── */

function ToggleSwitch({
  checked,
  onClick,
}: {
  checked: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className="cursor-pointer"
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

/* ─── Success-rate cell ───────────────────────────────────────── */

function SuccessRate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-sm text-gray-400">-</span>
  const pct = Math.round(rate * 100)
  const tone =
    pct >= 95
      ? 'text-emerald-600'
      : pct >= 80
        ? 'text-gray-500'
        : 'text-amber-600'
  return <span className={`text-sm ${tone}`}>{pct}%</span>
}
