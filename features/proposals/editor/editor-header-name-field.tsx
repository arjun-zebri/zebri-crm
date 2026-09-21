'use client'

/**
 * The template editor header's rename field and autosave status label
 * (Proposal Layout v2 Phase 2 Task 14), split out of `editor-header.tsx`
 * to keep that file under the ~150-line guideline.
 *
 * @module features/proposals/editor/editor-header-name-field
 */
import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { formatSaveStatus, type SaveStatus } from '@/lib/branding/use-autosave'

/** The template name: a button that turns into an `Input` while editing. Mirrors `template-row.tsx`'s rename field. */
export function NameField({ value, onCommit }: { value: string; onCommit: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Adopts a server-confirmed name once it lands, same render-phase pattern
  // (and same reasoning) as `template-row.tsx`'s `syncedName`.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  // Guards `commit` against the blur an Escape-triggered unmount can still
  // fire, in either order; reset whenever a new edit starts. See
  // `template-row.tsx`'s matching comment for the full reasoning.
  const cancelledRef = useRef(false)

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      const ok = await onCommit(trimmed)
      if (!ok) setDraft(value)
    } else {
      setDraft(value)
    }
  }

  if (editing) {
    return (
      <Input
        aria-label="Template name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            cancelledRef.current = true
            setDraft(value)
            setEditing(false)
          }
        }}
        autoFocus
        className="max-w-xs"
      />
    )
  }

  return (
    <Tooltip label="Click to rename">
      {/* `draft`, not `value`: right after a successful rename `draft`
          already holds the confirmed name (`commit` only reverts it on
          failure), while `value` is the prop and only catches up once the
          caller's refetch lands. Rendering `value` here flashed the old
          name for that gap. */}
      <Button
        variant="ghost"
        aria-label={`Rename ${draft}`}
        onClick={() => {
          cancelledRef.current = false
          setEditing(true)
        }}
        // `group`: the pencil (UX audit §3.7 - "no affordance" on the
        // title's click-to-rename) brightens on hover of the whole button,
        // not just the icon itself.
        className="group max-w-xs min-w-0 justify-start gap-1.5"
      >
        <span className="min-w-0 truncate font-medium text-text">{draft}</span>
        {/* Always visible at reduced opacity, full opacity on hover -
            never hidden outright, so a first-time user sees the
            affordance without having to discover it by hovering. */}
        <Pencil size={14} strokeWidth={1.5} className="shrink-0 text-text-muted opacity-50 transition-opacity group-hover:opacity-100" />
      </Button>
    </Tooltip>
  )
}

/** Props for {@link SaveStatusLabel}. */
export interface SaveStatusLabelProps {
  status: SaveStatus
  lastSavedAt: number | null
  /** Retries the last failed save. Rendered as a "Retry save" button while `status === 'error'`. */
  onRetry: () => void
}

/**
 * The autosave status text, ticking every 30s so a "Saved Xm ago" label
 * ages without a remount. Muted and silent almost all of the time; it
 * grows a button only when the MC has to act: "Retry save" after a
 * failure (the hook is already retrying on its own, this just skips the
 * backoff), and "Reload" after a conflict, when another tab or device
 * wrote a newer version and re-sending this one would overwrite it.
 */
export function SaveStatusLabel({ status, lastSavedAt, onRetry }: SaveStatusLabelProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const label = formatSaveStatus(status, lastSavedAt, now)
  if (!label) return null
  if (status === 'error' || status === 'conflict') {
    const conflict = status === 'conflict'
    return (
      <span className="flex shrink-0 items-center gap-1" role="status">
        <span className="text-body text-danger">{label}</span>
        {conflict
          ? <Button variant="ghost" onClick={() => window.location.reload()}>Reload</Button>
          : <Button variant="ghost" onClick={onRetry}>Retry save</Button>}
      </span>
    )
  }
  return <span className="shrink-0 text-body text-text-muted" role="status">{label}</span>
}
