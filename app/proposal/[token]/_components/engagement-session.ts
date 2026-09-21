/**
 * Session identity and visible-time bookkeeping for the public
 * proposal's engagement tracker (spec 9, plan E1/E2). Delivery lives in
 * `./engagement-post`.
 *
 * Kept apart from `./engagement-tracker` (which owns the observers and the
 * flush schedule) so the id and ledger logic can be unit tested without
 * React or a DOM.
 *
 * @module app/proposal/[token]/_components/engagement-session
 */
/** Prefix for the `sessionStorage` key a session id is cached under, namespaced per token so two proposal tabs never share an id. */
export const SESSION_KEY_PREFIX = 'proposal-session:'

/**
 * The engagement session id for this browser tab's view of one proposal
 * token. Cached in `sessionStorage` so a reload keeps the same id -- the
 * aggregation layer can then tell "the same visit, refreshed" from "a new
 * visit". Falls back to an in-memory random id when `sessionStorage` is
 * unavailable (Safari private mode, or a blocked storage policy), so
 * tracking degrades instead of throwing and breaking the page.
 */
export function sessionIdFor(token: string): string {
  const key = `${SESSION_KEY_PREFIX}${token}`
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    // No storage to persist to, so this id only survives for the current
    // closure -- fine, since without storage there is nothing to resume
    // across a reload anyway.
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }
}

/**
 * A fresh client-generated id for one engagement event -- the idempotency
 * key `record_proposal_events` dedupes on. Call once per event, when it
 * is queued (`engagement-tracker.tsx`), never again on a requeued retry,
 * or the retry would carry a fresh id and defeat the dedup. Same
 * fallback as {@link sessionIdFor} for an environment without
 * `crypto.randomUUID`.
 */
export function newEventId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }
}

/** One drained ledger entry: the accumulated whole seconds banked for one id since its last drain. */
export interface LedgerEntry {
  id: string
  seconds: number
}

/**
 * Accumulates visible seconds per id across start/stop calls, in whole
 * seconds, so a section or package card that is intersected on and off
 * still reports one running total instead of a burst of tiny events.
 */
export interface VisibleLedger {
  /** Marks `id` as visible starting at `now` (ms). Idempotent: starting an
   * id that is already running keeps its original start time. */
  start(id: string, now: number): void
  /** Marks `id` as no longer visible at `now` (ms), banking the elapsed time. */
  stop(id: string, now: number): void
  /** Stops every currently-running id at `now` (ms) -- used when the tab goes hidden. */
  stopAll(now: number): void
  /**
   * Drains every id with at least one whole banked second, resetting each
   * to its sub-second remainder (no fraction lost across drains) and
   * restarting still-running ids from `now` minus that remainder.
   */
  drain(now: number): LedgerEntry[]
}

/** See {@link VisibleLedger}. */
export function visibleSecondsLedger(): VisibleLedger {
  const running = new Map<string, number>()
  const banked = new Map<string, number>()
  // Insertion order of every id ever started, so `drain` returns entries in
  // a stable, predictable order rather than whatever order the two Maps
  // happen to iterate in.
  const order: string[] = []
  const seen = new Set<string>()
  const remember = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }

  return {
    start(id, now) {
      remember(id)
      // Idempotent: a real IntersectionObserver can report the same target as
      // intersecting twice with no intervening exit (a relayout or resize
      // while it is already on screen). Overwriting the start timestamp there
      // would silently discard every second accrued since the first entry.
      if (running.has(id)) return
      running.set(id, now)
    },
    stop(id, now) {
      const startedAt = running.get(id)
      if (startedAt === undefined) return
      banked.set(id, (banked.get(id) ?? 0) + (now - startedAt))
      running.delete(id)
    },
    stopAll(now) {
      for (const [id, startedAt] of running) {
        banked.set(id, (banked.get(id) ?? 0) + (now - startedAt))
      }
      running.clear()
    },
    drain(now) {
      const out: LedgerEntry[] = []
      for (const id of order) {
        const startedAt = running.get(id)
        const elapsedMs = (banked.get(id) ?? 0) + (startedAt !== undefined ? now - startedAt : 0)
        const seconds = Math.floor(elapsedMs / 1000)
        const remainder = elapsedMs - seconds * 1000
        banked.set(id, remainder)
        if (startedAt !== undefined) running.set(id, now - remainder)
        if (seconds >= 1) out.push({ id, seconds })
      }
      return out
    },
  }
}
