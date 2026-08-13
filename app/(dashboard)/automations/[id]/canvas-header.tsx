/**
 * Top header on the canvas builder.
 *
 * Matches the rest of the app's header conventions:
 *
 *   - `px-6` padding (same as page headers)
 *   - `text-body` font-semibold name input (inline rename on blur /
 *     enter). Deliberately not a title token: the canvas is chrome
 *     around a workspace, not a content page, and both `text-section`
 *     and `text-display` read as oversized against the controls
 *     sitting beside them in the same row.
 *   - every control is the `Button` primitive, so the row is one
 *     32px height and one text size with no hand-set padding
 *   - subtle StatePill for active / paused state
 *
 * @module app/(dashboard)/automations/[id]/canvas-header
 */
'use client'

import { ArrowLeft, History, Play, Power } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
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
      <Button
        variant="ghost"
        iconOnly
        onClick={onBack}
        className="-ml-2 shrink-0"
        aria-label="Back to automations"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
      </Button>

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="flex-1 min-w-0 max-w-sm text-body font-semibold text-text bg-transparent outline-none border-none px-1.5 py-0.5"
        placeholder="Untitled automation"
      />

      <div className="ml-auto flex items-center gap-3">
        <StatusPill status={status} />
        <SavedIndicator at={savedAt} />
        <Button
          variant="outline"
          onClick={onShowRuns}
          title="See recent runs and any errors"
          className="gap-1.5"
        >
          <History size={14} strokeWidth={1.5} />
          Runs
        </Button>
        <Button
          variant="outline"
          disabled
          title="Run a test against a real couple (coming soon)"
          className="gap-1.5"
        >
          <Play size={14} strokeWidth={1.5} />
          Test Flow
        </Button>
        <Button
          variant={isActive ? 'outline' : 'primary'}
          onClick={onToggleActive}
          className="gap-1.5"
        >
          <Power size={14} strokeWidth={1.5} />
          {isActive ? 'Pause' : 'Activate'}
        </Button>
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
  return <span className="text-body text-text-muted">Saved · {relative(at)}</span>
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
