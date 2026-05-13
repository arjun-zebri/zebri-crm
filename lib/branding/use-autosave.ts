'use client'

import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  debounceMs = 800
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const lastSerialized = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  }, [save])

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

  return { status, lastSavedAt }
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
