/**
 * The layout editor's local draft: a `localStorage` mirror of the layout
 * being edited, so the browser holds a copy the moment a change is made
 * rather than only once the debounced autosave has landed. This is what
 * lets a refresh inside the autosave window, a failed save, or a closed
 * tab restore the work instead of losing it (2026-09-20 "lost on refresh"
 * root cause) - the same local-first pattern Qwilr, Canva and Google Docs
 * rely on.
 *
 * Pure functions, no React: `use-layout-autosave.ts` writes the draft on
 * every change and clears it once the server confirms, and each editor's
 * load gate (`template-editor.tsx`, `proposal-editor.tsx`) reconciles it
 * against the loaded row with {@link reconcileDraft}.
 *
 * Every read and write is wrapped: `localStorage` can be absent, full, or
 * throw (private mode, cleared site data), and the editor must keep
 * working without it - the draft is a safety net, never the source of
 * truth.
 *
 * @module features/proposals/editor/local-draft
 */
import type { ProposalLayout } from '../model/layout'
import { parseProposalLayout } from '../model/schema'

/**
 * Which row a draft belongs to. A template and a proposal are separate
 * tables with separate id spaces, and the editor mounts on either, so the
 * kind has to be part of the storage key (see {@link draftKey}).
 */
export type LayoutTargetKind = 'template' | 'proposal'

/** What the browser keeps for one template or proposal between saves. */
export interface LocalDraft {
  /** The layout as last edited. */
  layout: ProposalLayout
  /** The server `revision` this draft was edited on top of (the client's last confirmed revision). */
  baseRevision: number
  /** `Date.now()` when the draft was written. */
  savedAt: number
}

const KEY_PREFIX = 'zebri:proposal-draft'

/**
 * The storage key for one user's draft of one template or proposal.
 *
 * Scoped by user id because `localStorage` outlives the session:
 * `signOut()` clears the auth cookies but not storage, so a browser-global
 * key would hand one account's draft to the next account that signs in on
 * that machine.
 *
 * Also scoped by `kind`, because a proposal created from a template is a
 * different row in a different table that the same editor mounts on: two
 * ids could in principle coincide, and reading a template's draft into a
 * proposal (or the reverse) would autosave one document's content over the
 * other's. `'template'` keeps the original, unprefixed key so a draft
 * written before this argument existed is still found after the deploy;
 * only the new `'proposal'` kind takes a segment of its own. That segment
 * sits where a user id used to, and a user id is always a uuid, so the two
 * shapes can never collide.
 */
export function draftKey(userId: string, id: string, kind: LayoutTargetKind = 'template'): string {
  return kind === 'template' ? `${KEY_PREFIX}:${userId}:${id}` : `${KEY_PREFIX}:${kind}:${userId}:${id}`
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Reads and validates the draft under `key`; `null` when absent, malformed, or holding a layout the schema rejects. */
export function readDraft(key: string): LocalDraft | null {
  try {
    const raw = storage()?.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { layout, baseRevision, savedAt } = parsed as Record<string, unknown>
    if (typeof baseRevision !== 'number' || typeof savedAt !== 'number') return null
    const valid = parseProposalLayout(layout)
    if (!valid.ok) return null
    return { layout: valid.layout, baseRevision, savedAt }
  } catch {
    return null
  }
}

/** Writes `draft` under `key`. Returns `false` when storage is unavailable or full. */
export function writeDraft(key: string, draft: LocalDraft): boolean {
  try {
    const store = storage()
    if (!store) return false
    store.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

/** Removes the draft under `key`, if any. */
export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // Nothing to do: a draft that cannot be cleared is discarded by
    // `reconcileDraft` the next time the server revision moves on.
  }
}

/** What the editor should mount with, and whether it needs saving straight away. */
export interface ReconciledLayout {
  layout: ProposalLayout
  /** True when `layout` is the draft and the server does not hold it yet. */
  dirty: boolean
}

/**
 * Decides between the server row and a local draft. The draft wins only
 * when it was edited on top of the revision the server still holds: then
 * it is strictly newer than the row (the row is what the draft started
 * from). A lower `baseRevision` means another tab or device has written
 * since, so the draft is stale and the server row wins - keeping it would
 * autosave old content over new. A draft identical to the row is simply
 * already saved.
 */
export function reconcileDraft(server: { layout: ProposalLayout; revision: number }, draft: LocalDraft | null): ReconciledLayout {
  if (!draft || draft.baseRevision !== server.revision) return { layout: server.layout, dirty: false }
  if (JSON.stringify(draft.layout) === JSON.stringify(server.layout)) return { layout: server.layout, dirty: false }
  return { layout: draft.layout, dirty: true }
}
