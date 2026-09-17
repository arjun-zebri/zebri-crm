'use client'

/**
 * The template editor header's rename field and save-status label
 * (Proposal Layout v2 Phase 2 Task 14), split out of `editor-header.tsx`
 * to keep that file under the ~150-line guideline.
 *
 * @module features/proposals/editor/editor-header-name-field
 */
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
        className="max-w-xs min-w-0 justify-start"
      >
        <span className="min-w-0 truncate font-medium text-text">{draft}</span>
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
 * ages without a remount. While `status === 'error'` the label is joined
 * by a "Retry save" button - without it, "Save failed" was a dead end: the
 * only way to recover was to make another edit.
 */
export function SaveStatusLabel({ status, lastSavedAt, onRetry }: SaveStatusLabelProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const label = formatSaveStatus(status, lastSavedAt, now)
  if (!label) return null
  if (status === 'error') {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-body text-danger">{label}</span>
        <Button variant="ghost" onClick={onRetry}>Retry save</Button>
      </span>
    )
  }
  return <span className="shrink-0 text-body text-text-muted">{label}</span>
}
