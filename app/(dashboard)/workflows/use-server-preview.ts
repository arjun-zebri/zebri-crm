/**
 * Fetch a server-rendered email preview, debounced, keeping the last
 * good one on screen while the next renders.
 *
 * Both email previews (the builder's Compose email modal and the step
 * detail modal) render on the server, through the send's own chain, and
 * re-render as the MC types. Two things make that calm rather than
 * jittery: a pause before each request, so a sentence is one render and
 * not forty, and keeping the last render between requests, so the email
 * does not flash back to a skeleton on every keystroke.
 *
 * Every render is stamped with the key it came from, so a panel can dim
 * an email for older input under "Updating" and never present it as the
 * one that will be sent (`current` / `pending` below).
 *
 * Plain state rather than React Query: the composer renders outside any
 * query provider in its tests and in the builder, and a preview is
 * throwaway, with nothing to share or cache.
 *
 * @module app/(dashboard)/workflows/use-server-preview
 */
'use client'

import { useEffect, useRef, useState } from 'react'

/** A server action's result, as every workflows action returns it. */
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** What a preview panel needs to draw itself. */
export interface ServerPreviewState<T> {
  /**
   * The latest successful render, or null before the first. It may be
   * for an OLDER input than the current key: check `current` before
   * presenting it as what will be sent.
   */
  data: T | null
  /** True when `data` was rendered from the current key. */
  current: boolean
  /**
   * True while the current key has neither a render nor an error yet: a
   * request is waiting on its debounce or in flight.
   */
  pending: boolean
  /** Why the render for the current key failed, else null. */
  error: string | null
  /** Ask again for the current key, e.g. after an error. */
  retry: () => void
}

/** The hook's own memory: each answer remembers the key it answered. */
interface Stored<T> {
  data: T | null
  dataKey: string | null
  error: string | null
  errorKey: string | null
}

const EMPTY: Stored<never> = { data: null, dataKey: null, error: null, errorKey: null }

/**
 * @param key - Changes whenever the preview must re-render (a
 *   serialisation of the draft). Equal keys never refetch. Every render
 *   is stamped with the key it was requested for.
 * @param load - Renders one preview. Read at fire time, so it may close
 *   over the latest draft without being a dependency.
 * @param options.enabled - False skips fetching and forgets every
 *   earlier render, so switching back on never shows a stale one.
 * @param options.delayMs - Quiet time before a render is requested.
 */
export function useServerPreview<T>(
  key: string,
  load: () => Promise<Result<T>>,
  { enabled = true, delayMs = 500 }: { enabled?: boolean; delayMs?: number } = {},
): ServerPreviewState<T> {
  const [stored, setStored] = useState<Stored<T>>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  // Declared before the fetch effect, so it runs first and the timer
  // below always calls the newest `load`.
  useEffect(() => {
    loadRef.current = load
  })
  // Answers can land out of order; only the newest request may write.
  const latest = useRef(0)

  // Switched off: forget during render, not in an effect, so the frame
  // that turns it back on can never paint an earlier session's render.
  if (!enabled && stored !== EMPTY) setStored(EMPTY)

  useEffect(() => {
    // Bumped even when off, so an answer still in flight is dropped.
    const request = ++latest.current
    if (!enabled) return
    const timer = setTimeout(() => {
      loadRef
        .current()
        .then((res) => {
          if (request !== latest.current) return
          // A failed render keeps the last good one in memory; `current`
          // tells the panel it is not for this input.
          setStored((prev) =>
            res.ok
              ? { data: res.data, dataKey: key, error: null, errorKey: null }
              : { ...prev, error: res.error, errorKey: key },
          )
        })
        .catch((err: unknown) => {
          if (request !== latest.current) return
          const message = err instanceof Error ? err.message : 'Could not render the preview.'
          setStored((prev) => ({ ...prev, error: message, errorKey: key }))
        })
    }, delayMs)
    return () => clearTimeout(timer)
  }, [key, enabled, delayMs, attempt])

  const current = enabled && stored.dataKey === key
  const error = enabled && stored.errorKey === key ? stored.error : null
  return {
    data: enabled ? stored.data : null,
    current,
    pending: enabled && !current && error === null,
    error,
    retry: () => {
      setStored((prev) => ({ ...prev, error: null, errorKey: null }))
      setAttempt((n) => n + 1)
    },
  }
}
