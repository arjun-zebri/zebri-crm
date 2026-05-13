'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseHistoryReturn<T> {
  state: T
  set: (updater: T | ((prev: T) => T), opts?: { commit?: boolean }) => void
  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  reset: (state: T) => void
}

const COMMIT_DEBOUNCE_MS = 500
const MAX_HISTORY = 50

export function useHistory<T>(initial: T): UseHistoryReturn<T> {
  const [state, setStateInner] = useState<T>(initial)
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCommittedRef = useRef<T>(initial)
  const [, force] = useState(0)
  const triggerRender = useCallback(() => force(n => n + 1), [])

  const commitNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setStateInner(current => {
      if (JSON.stringify(current) === JSON.stringify(lastCommittedRef.current)) {
        return current
      }
      pastRef.current.push(lastCommittedRef.current)
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
      futureRef.current = []
      lastCommittedRef.current = current
      triggerRender()
      return current
    })
  }, [triggerRender])

  const set = useCallback(
    (updater: T | ((prev: T) => T), opts?: { commit?: boolean }) => {
      setStateInner(prev => {
        const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
        return next
      })
      if (timerRef.current) clearTimeout(timerRef.current)
      if (opts?.commit) {
        timerRef.current = setTimeout(commitNow, 0)
      } else {
        timerRef.current = setTimeout(commitNow, COMMIT_DEBOUNCE_MS)
      }
    },
    [commitNow]
  )

  const undo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const past = pastRef.current
    if (past.length === 0) return
    const previous = past.pop()!
    futureRef.current.push(lastCommittedRef.current)
    lastCommittedRef.current = previous
    setStateInner(previous)
    triggerRender()
  }, [triggerRender])

  const redo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const future = futureRef.current
    if (future.length === 0) return
    const next = future.pop()!
    pastRef.current.push(lastCommittedRef.current)
    lastCommittedRef.current = next
    setStateInner(next)
    triggerRender()
  }, [triggerRender])

  const reset = useCallback((newState: T) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    pastRef.current = []
    futureRef.current = []
    lastCommittedRef.current = newState
    setStateInner(newState)
    triggerRender()
  }, [triggerRender])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  return {
    state,
    set,
    commit: commitNow,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset,
  }
}
