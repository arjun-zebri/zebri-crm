/**
 * Top header on the canvas builder.
 *
 * Matches the rest of the app's header conventions:
 *
 *   - `px-6` padding (same as page headers)
 *   - text-sm font-semibold name input (inline rename on blur /
 *     enter); we deliberately don't go larger because the canvas
 *     is a tool not a content page, and a 3xl title would crowd
 *     the workspace
 *   - text-xs primary buttons (matches the "New automation"
 *     button on the list page)
 *   - subtle StatePill for active / paused state
 *
 * @module app/(dashboard)/automations/[id]/canvas-header
 */
'use client'

import { ArrowLeft, History, Play, Power } from 'lucide-react'
import { useEffect, useState } from 'react'

import { StatePill } from '@/components/ui/state-pill'
import type { AutomationStatus } from '@/types/automations'

interface Props {
  name: string
  status: AutomationStatus
  savedAt: Date
  onBack: () => void
  onRename: (name: string) => void
  onToggleActive: () => void
  onShowRuns: () => void
}

export function CanvasHeader({ name, status, savedAt, onBack, onRename, onToggleActive, onShowRuns }: Props) {
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])

  const isActive = status === 'active'

  return (
    <header className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface">
      <button
        type="button"
        onClick={onBack}
        className="text-text-muted hover:text-text cursor-pointer p-1 -ml-1"
        aria-label="Back to automations"
      >
        <ArrowLeft size={18} strokeWidth={1.5} />
      </button>

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="flex-1 min-w-0 max-w-sm text-sm font-semibold bg-transparent outline-none border-none px-1.5 py-0.5"
        placeholder="Untitled automation"
      />

      <div className="ml-auto flex items-center gap-3">
        <StatusPill status={status} />
        <SavedIndicator at={savedAt} />
        <button
          type="button"
          onClick={onShowRuns}
          title="See recent runs and any errors"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-text hover:bg-surface-muted cursor-pointer transition"
        >
          <History size={12} strokeWidth={1.5} />
          Runs
        </button>
        <button
          type="button"
          disabled
          title="Run a test against a real couple (coming soon)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-text-muted disabled:opacity-50 cursor-not-allowed"
        >
          <Play size={12} strokeWidth={1.5} />
          Test Flow
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md cursor-pointer transition ${
            isActive
              ? 'border border-border text-text hover:bg-surface-muted'
              : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          <Power size={12} strokeWidth={1.5} />
          {isActive ? 'Pause' : 'Activate'}
        </button>
      </div>
    </header>
  )
}

function StatusPill({ status }: { status: AutomationStatus }) {
  const map: Record<AutomationStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
    draft: { label: 'Draft', tone: 'neutral' },
    active: { label: 'Active', tone: 'success' },
    paused: { label: 'Paused', tone: 'warning' },
    archived: { label: 'Archived', tone: 'neutral' },
  }
  const entry = map[status]
  return <StatePill tone={entry.tone} label={entry.label} dot="filled" />
}

function SavedIndicator({ at }: { at: Date }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])
  return <span className="text-xs text-text-muted">Saved · {relative(at)}</span>
}

function relative(at: Date): string {
  const diff = Math.max(0, Date.now() - at.getTime())
  if (diff < 5000) return 'just now'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
