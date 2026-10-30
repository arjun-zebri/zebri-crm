'use client'

/**
 * Autosaves a layout as it changes in the editor (Proposal Layout v2 Phase
 * 2 Task 14; hardened 2026-09-20 after the "lost on refresh"
 * investigation; generalised for roadmap R3 §6.1 so the same editor can
 * mount on a proposal's own copy of a template design). Four layers, each
 * covering a hole the one above leaves:
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
 *    restore the work (each editor's load gate reconciles it on load and
 *    mounts `initialDirty` so it saves straight away). The key carries the
 *    target's kind as well as its id, so a proposal's draft and a
 *    template's can never be read into each other.
 * 4. **Unload beacon**: a hard refresh / tab close inside the debounce
 *    never runs React's unmount cleanup, so `onUnload` beacons the
 *    pending layout to the target's beacon route (a plain route built only
 *    so `sendBeacon` has something to call). The browser is also asked to
 *    prompt before leaving when a save has actually failed
 *    (`promptOnUnload`).
 *
 * The two kinds differ only in which server action and which beacon route
 * they write through: `proposal_templates` and `proposals` carry the same
 * compare-and-set revision guard and return the same tagged result, so
 * everything above is shared verbatim rather than forked.
 *
 * A proposal target may also arrive with **no row behind it yet** (the
 * "Make edits" route, `/proposals/design/new`): the editor is mounted on a
 * copy of the template's layout held in memory, and the `proposals` row is
 * created by the save path itself, on the first change worth keeping
 * (founder, 2026-09-23: opening the editor and backing out used to leave
 * an untouched draft behind that `/proposals` counted and nothing could
 * open). Materialising inside `save` rather than beside it is what keeps
 * that single: layer 1 already allows only one save on the wire at a time,
 * and {@link useLayoutAutosave} holds the create in a single-flight ref, so
 * a retry, a second tab-local save and React StrictMode's double mount all
 * await the same create rather than minting the couple a second proposal.
 * Until it exists there is no id to key a draft or a beacon on, so layers 3
 * and 4 stay switched off for that one first change and switch on the
 * moment the row lands.
 *
 * What counts as "a change worth keeping" is `sameDocument`
 * (`layout-equivalence.ts`), not a string comparison: mounting the canvas
 * rebuilds objects and lets TipTap repair the document it was handed (an
 * empty paragraph after anything you cannot type after), and a row must
 * never appear because of either.
 *
 * @module features/proposals/editor/use-layout-autosave
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { logger } from '@/lib/alerts/logger'
import { AutosaveConflictError, useAutosave, type SaveStatus } from '@/lib/branding/use-autosave'
import { toPlainJSON } from '@/lib/utils'

import { updateProposalLayoutAction } from '../data/proposals'
import { updateTemplateLayoutAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'
import { parseProposalLayout } from '../model/schema'

import { sameDocument } from './layout-equivalence'
import { clearDraft, draftKey, writeDraft } from './local-draft'

/** A row that now exists, and the revision its layout is at. */
export interface MaterialisedTarget {
  id: string
  revision: number
}

/**
 * Which row the editor is mounted on, and which id it saves under.
 *
 * The third member is a proposal that has not been created yet: `id` is
 * `null` and `create` mints the row the first time the editor has
 * something worth saving. See the module doc for why that lives inside
 * the save path.
 */
export type LayoutTarget =
  | { kind: 'template'; id: string }
  | { kind: 'proposal'; id: string }
  | {
      kind: 'proposal'
      id: null
      /** Creates the row and returns it. Called at most once per editor, however many saves race for it. */
      create: () => Promise<MaterialisedTarget>
      /** Told the new id as soon as it exists, before the save that created it lands. */
      onCreated?: (id: string) => void
    }

/**
 * Beacon endpoint per kind. Both exist only because `navigator.sendBeacon`
 * cannot invoke a Server Action; see either route's module doc.
 */
const BEACON_URL: Record<LayoutTarget['kind'], string> = {
  template: '/api/proposals/templates/layout-beacon',
  proposal: '/api/proposals/layout-beacon',
}

/** Options for {@link useLayoutAutosave}. */
export interface UseTemplateAutosaveOptions {
  /** The row's current layout revision as loaded (or as the local draft was based on). */
  revision: number
  /** Scopes the local draft; `null` disables the draft (the other layers still run). */
  userId: string | null
  /** True when the mounted layout is a restored local draft the server does not hold yet: it is saved after the first debounce. */
  initialDirty?: boolean
}

/** What {@link useLayoutAutosave} returns. */
export interface UseTemplateAutosaveReturn {
  status: SaveStatus
  lastSavedAt: number | null
  /** Re-runs the save with the latest layout after a failure. */
  retry: () => void
}

/** Autosaves `layout` for `target`. See the module doc for the four layers. */
export function useLayoutAutosave(target: LayoutTarget, layout: ProposalLayout, options: UseTemplateAutosaveOptions): UseTemplateAutosaveReturn {
  const { revision, userId, initialDirty = false } = options
  // Destructured to primitives straight away: callers build the `target`
  // object inline, so depending on the object itself would rebuild every
  // callback below on each render and restart the debounce mid-typing.
  const { kind } = target
  const givenId = target.id
  const create = target.id === null ? target.create : null
  // `onCreated` is a render-scoped callback on the caller's side, so it
  // rides a ref: rebuilding `ensureId` whenever it changed identity would
  // gain nothing and churn the save callback below with it.
  const onCreatedRef = useRef<((id: string) => void) | undefined>(undefined)
  const onCreated = target.id === null ? target.onCreated : undefined
  useEffect(() => {
    onCreatedRef.current = onCreated
  }, [onCreated])
  // The document as mounted, for an uncreated target: a save whose value
  // is still the same document must not bring a proposal into existence.
  // Mounting the canvas rebuilds objects and lets TipTap repair what it
  // was handed, and neither is the MC changing anything - see
  // `layout-equivalence.ts`.
  const mountedRef = useRef(layout)
  // The id every save, draft and beacon actually uses: the one handed in,
  // or the one `create` produced. A ref as well as state because a save
  // already in flight has to see it without waiting for a render.
  const idRef = useRef<string | null>(givenId)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const id = givenId ?? createdId
  // The revision the next save is based on: the loaded one until the
  // first confirmed write, then whatever the server last handed back.
  const revisionRef = useRef(revision)
  // No id yet means no draft: `local-draft.ts` keys on one, and there is
  // nothing a restored draft could be reconciled against until the row
  // exists. It switches on by itself the moment `ensureId` lands one.
  const key = userId && id ? draftKey(userId, id, kind) : null
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

  // The create, held once. `??=` is what makes it single-flight: every
  // later caller awaits the same promise, so two saves racing (an
  // automatic retry, a flush on unmount, StrictMode's double mount)
  // cannot mint the couple two proposals.
  const createPromiseRef = useRef<Promise<MaterialisedTarget> | null>(null)
  const ensureId = useCallback(async (): Promise<string> => {
    const known = idRef.current
    if (known) return known
    if (!create) throw new Error('This editor has no row to save into')
    createPromiseRef.current ??= create()
    const made = await createPromiseRef.current
    idRef.current = made.id
    // The new row carries its own revision, not the placeholder the editor
    // mounted with: the first save has to be based on that, or the
    // compare-and-set below misses on a row nobody else has touched.
    revisionRef.current = made.revision
    setCreatedId(made.id)
    onCreatedRef.current?.(made.id)
    return made.id
  }, [create])

  const save = useCallback(async (value: ProposalLayout) => {
    const parsed = parseProposalLayout(value)
    if (!parsed.ok) {
      const issues = parsed.issues.slice(0, 5)
      // Logged under the field name the target's own telemetry already
      // uses, so an alert about a template still reads `templateId`.
      const idField = kind === 'template' ? { templateId: idRef.current } : { proposalId: idRef.current }
      logger.error('proposal_layout_invalid_editor', undefined, { ...idField, issues })
      // The issues ride on the thrown error too: the Next dev overlay
      // renders the logger's context object as `{}`, so without this the
      // one place a developer sees the failure names no cause.
      throw new Error(`Layout failed validation: ${issues.join('; ')}`)
    }
    const sent = toPlainJSON(parsed.layout)
    // Nothing to write and nothing to create: the editor is sitting on
    // the document it opened with. Returning rather than throwing marks
    // it settled, so this does not retry in a loop.
    if (!idRef.current && create && sameDocument(parsed.layout, mountedRef.current)) return
    // After the validation above, never before it: a layout the schema
    // rejects must not be the reason a couple gets a proposal row.
    //
    // The `??` matters. An editor mounted on a row that already exists
    // must reach its server action in this same synchronous turn: the
    // `flushOnUnmount` path fires `save` from React's unmount cleanup, and
    // an `await` before the call would leave the request sitting in a
    // microtask. Only the uncreated case, which has no id to send, waits.
    const targetId = idRef.current ?? (await ensureId())
    const input = { id: targetId, layout: sent, baseRevision: revisionRef.current }
    const result = kind === 'template' ? await updateTemplateLayoutAction(input) : await updateProposalLayoutAction(input)
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
  }, [kind, key, create, ensureId])

  // Layer 4: fire-and-forget beacon for `onUnload`. Re-validates with
  // `parseProposalLayout` for the same reason `save` does above - a beacon
  // that reaches the server is never awaited or retried, so a bad layout
  // must be dropped here rather than corrupt the stored one.
  const onUnload = useCallback((value: ProposalLayout) => {
    // No row yet means no id to beacon under, and `sendBeacon` cannot
    // create one (it cannot invoke a Server Action). A hard unload inside
    // the debounce on the very first change is therefore the one gap the
    // create-on-first-change trade brings with it; every later change is
    // covered as before.
    const beaconId = idRef.current
    if (!beaconId) return
    const parsed = parseProposalLayout(value)
    if (!parsed.ok) return
    // A plain string, not a `Blob`: the route reads the body with
    // `request.json()` regardless of the content-type `sendBeacon` sends
    // for a string (`text/plain`), and a string needs no Blob/File-API
    // support from whatever sends it.
    const body = JSON.stringify({ id: beaconId, layout: toPlainJSON(parsed.layout), baseRevision: revisionRef.current })
    navigator.sendBeacon(BEACON_URL[kind], body)
  }, [kind])

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
