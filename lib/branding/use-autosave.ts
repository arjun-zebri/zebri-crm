'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where an autosaved value stands relative to the server.
 *
 * - `idle`: nothing has changed since mount.
 * - `saving`: a change is debouncing or on the wire.
 * - `saved`: the latest value is confirmed stored.
 * - `error`: the last attempt failed; the hook keeps retrying on its own
 *   (see {@link useAutosave}'s backoff) and `retry()` forces one now.
 * - `conflict`: the server holds a newer version written elsewhere (`save`
 *   threw {@link AutosaveConflictError}); re-sending would only conflict
 *   again, so the hook stops and leaves the caller to offer a reload.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

/**
 * Thrown by a `save` callback when the server refused the write because
 * its copy has moved on (an optimistic-concurrency miss). The hook treats
 * it differently from every other failure: no automatic retry, and
 * `status` becomes `'conflict'` rather than `'error'`.
 */
export class AutosaveConflictError extends Error {
  constructor(message = 'The server holds a newer version') {
    super(message)
    this.name = 'AutosaveConflictError'
  }
}

/** Options for {@link useAutosave}. */
export interface UseAutosaveOptions<T> {
  /**
   * When true, unsaved content is flushed immediately when this hook
   * unmounts instead of silently dropped: any pending debounce or backoff
   * timer is cancelled and `save` is invoked once more with the latest
   * value, fire-and-forget (the component is already gone, so there is no
   * `status` left to update). Off by default, so every existing caller
   * keeps its exact current behaviour.
   *
   * "Unsaved" covers both a change still inside the debounce window and a
   * value whose last save attempt failed: clicking "Back" right after
   * typing, or after a failed save, used to drop that edit entirely even
   * though the header was still showing "Saving…" / "Save failed".
   *
   * This only covers a React unmount (an in-app navigation). It cannot
   * help with {@link onUnload} below - see that option for why a second,
   * separate mechanism exists.
   */
  flushOnUnmount?: boolean
  /**
   * Called with the latest value on `beforeunload` (browser refresh, tab
   * close, or navigating off-site) if that value is not confirmed saved.
   * `flushOnUnmount` cannot cover this case: a real navigation/reload/close
   * tears down the JS runtime immediately, so React's unmount cleanup - and
   * any `await save(...)` inside it - never gets to run. The callback must
   * therefore be synchronous and fire-and-forget, e.g.
   * `navigator.sendBeacon` or `fetch(url, { keepalive: true })` to a plain
   * endpoint (a Server Action can't be targeted by either). There is no way
   * to know whether it actually reached the server - the page is gone by
   * then - so this is best-effort, not a guarantee.
   *
   * "Not confirmed saved" is deliberate: a value whose save is in flight or
   * whose last attempt failed is sent too. A duplicate of an in-flight
   * write is harmless; skipping a failed one is how a refresh after any
   * failed save used to lose the edit with no beacon at all.
   */
  onUnload?: (value: T) => void
  /**
   * When true, `beforeunload` is cancelled (so the browser shows its
   * "Leave site?" prompt) while there is unsynced content whose last save
   * attempt failed or conflicted. A change still inside the debounce window
   * does not prompt: `onUnload` (and, for the template editor, its local
   * draft) already cover that window, and prompting on every quick refresh
   * would nag for nothing.
   */
  promptOnUnload?: boolean
  /**
   * When true, the value present on the very first render is treated as
   * unsaved and sent after the debounce, instead of assumed to be what the
   * server already holds. For an editor that mounts on a locally
   * recovered draft rather than the server row.
   */
  saveInitial?: boolean
}

/** Backoff between automatic retries of a failed save: 1s, 2s, 4s, … capped. */
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000

/**
 * Autosave hook with debouncing, error handling, automatic retry with
 * exponential backoff, and manual retry.
 * Automatically saves changes after debounceMs of inactivity.
 * @param value - The value to autosave
 * @param save - Async function to persist the value. Throw
 *   {@link AutosaveConflictError} for an optimistic-concurrency miss.
 * @param debounceMs - Debounce delay in milliseconds (default 800)
 * @param options - See {@link UseAutosaveOptions}.
 * @returns Object with status, lastSavedAt timestamp, and retry function
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  debounceMs = 800,
  options: UseAutosaveOptions<T> = {}
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const lastSerialized = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)
  const valueRef = useRef<T>(value)
  const flushOnUnmountRef = useRef(options.flushOnUnmount ?? false)
  const onUnloadRef = useRef(options.onUnload)
  const promptOnUnloadRef = useRef(options.promptOnUnload ?? false)
  const saveInitialRef = useRef(options.saveInitial ?? false)
  // The serialized form of the last value the server CONFIRMED (set only
  // once `save` resolves, never before). `onUnload`, `flushOnUnmount` and
  // the unload prompt all compare the live value against this to tell
  // "already stored, nothing to do" from "still only in this tab". Starts
  // as the initial value: that came from the server, so there is nothing
  // to send for it (unless `saveInitial` says otherwise).
  const savedSerialized = useRef<string | null>(null)
  // Whether a `save()` call is currently awaiting its server response, and
  // the latest value that arrived while it was - see `runSave` below.
  const inFlightRef = useRef(false)
  const queuedRef = useRef<{ value: T } | null>(null)
  // Consecutive failures since the last success: drives the backoff.
  const failuresRef = useRef(0)
  // Whether the most recent attempt failed or conflicted: gates the unload prompt.
  const lastAttemptFailedRef = useRef(false)
  const unmountedRef = useRef(false)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const clearBackoff = () => {
    if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current)
    backoffTimerRef.current = null
  }

  /**
   * Sends `value`, unless a previous `save()` is still in flight - then it
   * only replaces whatever was queued, to be sent the moment the in-flight
   * one settles. This is the fix for autosave silently reverting content:
   * the debounce timer alone only ever stopped a second *timer* firing
   * while one was pending, never a second *save()* firing while an
   * earlier one's promise was still unresolved (normal network latency
   * variance is enough to trigger this on every proposal template with a
   * few edits close together). Two such requests can complete out of
   * order at the server - so whichever response lands last wins, even if
   * it was the older edit. Keeping at most one save on the wire at a time
   * removes the race entirely: responses can now only ever complete in
   * send order.
   *
   * A failure (other than a conflict) schedules an automatic retry of the
   * latest value after an exponential backoff, so a transient outage never
   * leaves content stranded until the user happens to make another edit.
   */
  const runSave = useCallback((value: T) => {
    if (inFlightRef.current) {
      queuedRef.current = { value }
      return
    }
    inFlightRef.current = true
    void (async () => {
      let current = value
      for (;;) {
        try {
          await saveRef.current(current)
          savedSerialized.current = JSON.stringify(current)
          failuresRef.current = 0
          lastAttemptFailedRef.current = false
          // A newer value already queued up while this one was in flight:
          // it is about to be sent immediately below, so this attempt's
          // result is already stale - skip reporting it, rather than
          // flashing "saved" (or "error") for content that's no longer
          // what the editor holds.
          if (!queuedRef.current) {
            setStatus('saved')
            setLastSavedAt(Date.now())
          }
        } catch (error) {
          lastAttemptFailedRef.current = true
          if (error instanceof AutosaveConflictError) {
            // Re-sending the same base would only conflict again: stop
            // here and let the caller offer a reload.
            if (!queuedRef.current) setStatus('conflict')
          } else {
            failuresRef.current += 1
            if (!queuedRef.current) {
              setStatus('error')
              if (!unmountedRef.current) {
                const delay = Math.min(BACKOFF_BASE_MS * 2 ** (failuresRef.current - 1), BACKOFF_MAX_MS)
                clearBackoff()
                backoffTimerRef.current = setTimeout(() => {
                  backoffTimerRef.current = null
                  runSave(valueRef.current)
                }, delay)
              }
            }
          }
        }
        const queued = queuedRef.current
        if (!queued) break
        queuedRef.current = null
        current = queued.value
        setStatus('saving')
      }
      inFlightRef.current = false
    })()
  }, [])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    flushOnUnmountRef.current = options.flushOnUnmount ?? false
  }, [options.flushOnUnmount])

  useEffect(() => {
    onUnloadRef.current = options.onUnload
  }, [options.onUnload])

  useEffect(() => {
    promptOnUnloadRef.current = options.promptOnUnload ?? false
  }, [options.promptOnUnload])

  // Best-effort save and/or prompt on a real browser unload (see
  // `onUnload` and `promptOnUnload`). Listener is added once (empty deps)
  // and reads the refs at fire time, so it always sees the latest
  // value/callback without re-subscribing on every change.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const latest = JSON.stringify(valueRef.current)
      if (latest === savedSerialized.current) return
      onUnloadRef.current?.(valueRef.current)
      if (promptOnUnloadRef.current && lastAttemptFailedRef.current) {
        event.preventDefault()
        // Legacy browsers need a non-empty `returnValue` to show the prompt.
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Flushes unsaved content on unmount (see `flushOnUnmount`). A separate
  // effect with an empty dependency array, not folded into the debounce
  // effect below: that effect's own cleanup runs on *every* `serialized`
  // change too (it is how the debounce resets), so it cannot tell a real
  // unmount apart from a normal reset. An empty-deps effect's cleanup only
  // ever runs once, on unmount.
  useEffect(() => {
    // Reset on (re)mount: dev-only StrictMode runs this cleanup once on a
    // fake unmount and then mounts again, and a flag left `true` would
    // disable every automatic retry for the rest of the session.
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      clearBackoff()
      if (!flushOnUnmountRef.current) return
      const pending = timerRef.current !== null
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      if (!pending && JSON.stringify(valueRef.current) === savedSerialized.current) return
      runSave(valueRef.current)
    }
  }, [runSave])

  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (lastSerialized.current === null) {
      lastSerialized.current = serialized
      if (!saveInitialRef.current) {
        savedSerialized.current = serialized
        return
      }
    } else if (lastSerialized.current === serialized) {
      // The same value re-running this effect: only StrictMode's dev
      // double-mount does that, and its fake unmount ran the cleanup below,
      // cancelling the timer this value was waiting on. Re-arm it if the
      // value is still unsaved and nothing else is already handling it.
      if (serialized === savedSerialized.current || timerRef.current || inFlightRef.current || backoffTimerRef.current) return
    } else {
      lastSerialized.current = serialized
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    // A fresh edit supersedes any scheduled retry: the debounce below will
    // send the newer value itself.
    clearBackoff()
    setStatus('saving')
    const captured = JSON.parse(serialized) as T
    timerRef.current = setTimeout(() => {
      // Cleared as soon as the timer actually fires, not left holding the
      // (by then meaningless) id of an already-elapsed timeout: the
      // `flushOnUnmount` cleanup above uses `timerRef.current` as its
      // "is a save still pending" signal, so a stale non-null value here
      // would make it re-send a save that already went out (or, worse, one
      // whose promise already rejected once).
      timerRef.current = null
      runSave(captured)
    }, debounceMs)

    return () => {
      // Nulled, not just cleared: the re-arm branch above reads
      // `timerRef.current` as "a save is already scheduled".
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [serialized, debounceMs, runSave])

  /**
   * Retry the save operation with the latest value.
   * Clears any previous error status and re-runs the save function.
   */
  const retry = () => {
    setStatus('saving')
    clearBackoff()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // See the matching comment in the debounce effect above.
      timerRef.current = null
      runSave(valueRef.current)
    }, debounceMs)
  }

  return { status, lastSavedAt, retry }
}

export function formatSaveStatus(
  status: SaveStatus,
  lastSavedAt: number | null,
  now: number
): string {
  if (status === 'saving') return 'Saving…'
  if (status === 'error') return 'Save failed'
  if (status === 'conflict') return 'Changed elsewhere'
  if (status === 'saved' && lastSavedAt) {
    const seconds = Math.floor((now - lastSavedAt) / 1000)
    if (seconds < 5) return 'Saved'
    if (seconds < 60) return `Saved ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `Saved ${minutes}m ago`
  }
  return ''
}
