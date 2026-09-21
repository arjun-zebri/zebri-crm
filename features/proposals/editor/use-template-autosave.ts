'use client'

/**
 * Autosaves a template's layout as it changes in the editor (Proposal
 * Layout v2 Phase 2 Task 14; hardened 2026-09-20 after the "lost on
 * refresh" investigation). Four layers, each covering a hole the one
 * above leaves:
 *
 * 1. **Debounced save** (`useAutosave`, `lib/branding/use-autosave.ts`):
 *    800ms after the last change, one request on the wire at a time,
 *    automatic retry with backoff when it fails. Every value is
 *    re-validated with `parseProposalLayout` first: a layout the editor
 *    itself produced must always pass its own schema, so a failure here
 *    means a bug upstream (a reducer branch, or a node view writing an
 *    attribute the schema does not allow), never a user mistake. The bad
 *    layout is logged and `save` throws - it must never reach the server
 *    (a transient editor bug could overwrite a good saved layout with a
 *    broken one), and it must not report success either.
 * 2. **Revision guard**: every save carries `baseRevision`, the revision
 *    the client last had confirmed, and adopts the one the server returns.
 *    A conflict whose server content already equals what the editor holds
 *    (typically our own beacon landing first) just adopts the revision;
 *    one with different content stops autosaving and reports `'conflict'`
 *    so the header can offer a reload - re-sending would only overwrite
 *    whatever was written elsewhere.
 * 3. **Local draft** (`local-draft.ts`): every change is mirrored into
 *    `localStorage` before the debounce elapses and cleared once the
 *    server confirms it, so a refresh, a failed save, or a closed tab can
 *    restore the work (`template-editor.tsx` reconciles it on load and
 *    mounts `initialDirty` so it saves straight away).
 * 4. **Unload beacon**: a hard refresh / tab close inside the debounce
 *    never runs React's unmount cleanup, so `onUnload` beacons the
 *    pending layout to `/api/proposals/templates/layout-beacon` (a plain
 *    route built only so `sendBeacon` has something to call). The browser
 *    is also asked to prompt before leaving when a save has actually
 *    failed (`promptOnUnload`).
 *
 * @module features/proposals/editor/use-template-autosave
 */
import { useCallback, useEffect, useRef } from 'react'

import { logger } from '@/lib/alerts/logger'
import { AutosaveConflictError, useAutosave, type SaveStatus } from '@/lib/branding/use-autosave'
import { toPlainJSON } from '@/lib/utils'

import { updateTemplateLayoutAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'
import { parseProposalLayout } from '../model/schema'

import { clearDraft, draftKey, writeDraft } from './local-draft'

const LAYOUT_BEACON_URL = '/api/proposals/templates/layout-beacon'

/** Options for {@link useTemplateAutosave}. */
export interface UseTemplateAutosaveOptions {
  /** The template's `revision` as loaded (or as the local draft was based on). */
  revision: number
  /** Scopes the local draft; `null` disables the draft (the other layers still run). */
  userId: string | null
  /** True when the mounted layout is a restored local draft the server does not hold yet: it is saved after the first debounce. */
  initialDirty?: boolean
}

/** What {@link useTemplateAutosave} returns. */
export interface UseTemplateAutosaveReturn {
  status: SaveStatus
  lastSavedAt: number | null
  /** Re-runs the save with the latest layout after a failure. */
  retry: () => void
}

/** Autosaves `layout` for template `id`. See the module doc for the four layers. */
export function useTemplateAutosave(id: string, layout: ProposalLayout, options: UseTemplateAutosaveOptions): UseTemplateAutosaveReturn {
  const { revision, userId, initialDirty = false } = options
  // The revision the next save is based on: the loaded one until the
  // first confirmed write, then whatever the server last handed back.
  const revisionRef = useRef(revision)
  const key = userId ? draftKey(userId, id) : null
  // Always the latest layout, so a save's success handler can tell
  // whether the value it confirmed is still what the editor holds.
  const latestRef = useRef(layout)
  useEffect(() => {
    latestRef.current = layout
  }, [layout])

  // Layer 3: the draft is written synchronously on every change, before
  // the debounce, so even an immediate refresh finds it.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      if (!initialDirty) return
    }
    if (!key) return
    writeDraft(key, { layout, baseRevision: revisionRef.current, savedAt: Date.now() })
  }, [key, layout, initialDirty])

  const save = useCallback(async (value: ProposalLayout) => {
    const parsed = parseProposalLayout(value)
    if (!parsed.ok) {
      const issues = parsed.issues.slice(0, 5)
      logger.error('proposal_layout_invalid_editor', undefined, { templateId: id, issues })
      // The issues ride on the thrown error too: the Next dev overlay
      // renders the logger's context object as `{}`, so without this the
      // one place a developer sees the failure names no cause.
      throw new Error(`Layout failed validation: ${issues.join('; ')}`)
    }
    const sent = toPlainJSON(parsed.layout)
    const result = await updateTemplateLayoutAction({ id, layout: sent, baseRevision: revisionRef.current })
    if (result.ok) {
      revisionRef.current = result.revision
    } else if (result.conflict && JSON.stringify(result.conflict.layout) === JSON.stringify(sent)) {
      // The server already holds exactly this content under a newer
      // revision - our own beacon, or the same edit from another tab.
      // Nothing was lost: adopt the revision and carry on.
      revisionRef.current = result.conflict.revision
    } else if (result.conflict) {
      throw new AutosaveConflictError(result.error)
    } else {
      throw new Error(result.error)
    }
    // Confirmed: the draft is only worth keeping while it is ahead of the
    // server. If the editor has moved on since this value was captured,
    // the change effect above has already overwritten the draft with the
    // newer layout, and clearing it here would drop that.
    if (key && JSON.stringify(latestRef.current) === JSON.stringify(value)) clearDraft(key)
  }, [id, key])

  // Layer 4: fire-and-forget beacon for `onUnload`. Re-validates with
  // `parseProposalLayout` for the same reason `save` does above - a beacon
  // that reaches the server is never awaited or retried, so a bad layout
  // must be dropped here rather than corrupt the stored one.
  const onUnload = useCallback((value: ProposalLayout) => {
    const parsed = parseProposalLayout(value)
    if (!parsed.ok) return
    // A plain string, not a `Blob`: the route reads the body with
    // `request.json()` regardless of the content-type `sendBeacon` sends
    // for a string (`text/plain`), and a string needs no Blob/File-API
    // support from whatever sends it.
    const body = JSON.stringify({ id, layout: toPlainJSON(parsed.layout), baseRevision: revisionRef.current })
    navigator.sendBeacon(LAYOUT_BEACON_URL, body)
  }, [id])

  // `flushOnUnmount`: unsaved content when the editor unmounts (Back to
  // Proposals within 800ms of the last edit, or after a failed save) is
  // sent once more with the latest layout instead of silently dropped.
  const { status, lastSavedAt, retry } = useAutosave(layout, save, 800, {
    flushOnUnmount: true,
    onUnload,
    promptOnUnload: true,
    saveInitial: initialDirty,
  })
  return { status, lastSavedAt, retry }
}
