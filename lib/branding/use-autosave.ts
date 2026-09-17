'use client'

import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Options for {@link useAutosave}. */
export interface UseAutosaveOptions {
  /**
   * When true, a save still pending when this hook unmounts is flushed
   * immediately instead of silently dropped: the pending debounce timer is
   * cancelled and `save` is invoked once more with the latest value,
   * fire-and-forget (the component is already gone, so there is no
   * `status` left to update). Off by default, so every existing caller
   * keeps its exact current behaviour.
   *
   * Without this, navigating away within the debounce window of the last
   * edit (e.g. clicking "Back" right after typing) drops that edit
   * entirely, even though the header was still showing "Saving…".
   */
  flushOnUnmount?: boolean
}

/**
 * Autosave hook with debouncing, error handling, and manual retry.
 * Automatically saves changes after debounceMs of inactivity.
 * @param value - The value to autosave
 * @param save - Async function to persist the value
 * @param debounceMs - Debounce delay in milliseconds (default 800)
 * @param options - See {@link UseAutosaveOptions}.
 * @returns Object with status, lastSavedAt timestamp, and retry function
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  debounceMs = 800,
  options: UseAutosaveOptions = {}
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const lastSerialized = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)
  const valueRef = useRef<T>(value)
  const flushOnUnmountRef = useRef(options.flushOnUnmount ?? false)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    flushOnUnmountRef.current = options.flushOnUnmount ?? false
  }, [options.flushOnUnmount])

  // Flushes a still-pending save on unmount (see `flushOnUnmount`). A
  // separate effect with an empty dependency array, not folded into the
  // debounce effect below: that effect's own cleanup runs on *every*
  // `serialized` change too (it is how the debounce resets), so it cannot
  // tell a real unmount apart from a normal reset. An empty-deps effect's
  // cleanup only ever runs once, on unmount.
  useEffect(() => {
    return () => {
      if (!flushOnUnmountRef.current) return
      if (!timerRef.current) return
      clearTimeout(timerRef.current)
      timerRef.current = null
      void saveRef.current(valueRef.current)
    }
  }, [])

  const serialized = JSON.stringify(value)

  useEffect(() => {
    if (lastSerialized.current === null) {
      lastSerialized.current = serialized
      return
    }
    if (lastSerialized.current === serialized) return
    lastSerialized.current = serialized

    if (timerRef.current) clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: gated by serialized comparison so no cascade
    setStatus('saving')
    const captured = JSON.parse(serialized) as T
    timerRef.current = setTimeout(async () => {
      // Cleared as soon as the timer actually fires, not left holding the
      // (by then meaningless) id of an already-elapsed timeout: the
      // `flushOnUnmount` cleanup above uses `timerRef.current` as its
      // "is a save still pending" signal, so a stale non-null value here
      // would make it re-send a save that already went out (or, worse, one
      // whose promise already rejected once).
      timerRef.current = null
      try {
        await saveRef.current(captured)
        setStatus('saved')
        setLastSavedAt(Date.now())
      } catch {
        setStatus('error')
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [serialized, debounceMs])

  /**
   * Retry the save operation with the latest value.
   * Clears any previous error status and re-runs the save function.
   */
  const retry = () => {
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      // See the matching comment in the debounce effect above.
      timerRef.current = null
      try {
        await saveRef.current(valueRef.current)
        setStatus('saved')
        setLastSavedAt(Date.now())
      } catch {
        setStatus('error')
      }
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
  if (status === 'saved' && lastSavedAt) {
    const seconds = Math.floor((now - lastSavedAt) / 1000)
    if (seconds < 5) return 'Saved'
    if (seconds < 60) return `Saved ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `Saved ${minutes}m ago`
  }
  return ''
}
