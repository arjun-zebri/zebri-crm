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
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCommittedRef = useRef<T>(initial)
  // The value on screen, readable synchronously. React only runs a
  // `setState` updater when it next renders, so `undo`/`redo` cannot read
  // the pending (not yet committed) value out of React state in the same
  // event they run in; every write below goes through this ref first.
  const latestRef = useRef<T>(initial)
  const [, force] = useState(0)
  const triggerRender = useCallback(() => force(n => n + 1), [])

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    })
  }, [])

  const commitNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const current = latestRef.current
    if (JSON.stringify(current) === JSON.stringify(lastCommittedRef.current)) return
    pastRef.current.push(lastCommittedRef.current)
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
    futureRef.current = []
    lastCommittedRef.current = current
    triggerRender()
    updateHistoryState()
  }, [triggerRender, updateHistoryState])

  const set = useCallback(
    (updater: T | ((prev: T) => T), opts?: { commit?: boolean }) => {
      // Resolved here rather than deferred to React so `latestRef` is
      // right the moment `set` returns; two `set`s in one handler still
      // compose in order because each reads the ref the last one wrote.
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(latestRef.current) : updater
      latestRef.current = next
      setStateInner(next)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (opts?.commit) {
        timerRef.current = setTimeout(commitNow, 0)
      } else {
        timerRef.current = setTimeout(commitNow, COMMIT_DEBOUNCE_MS)
      }
    },
    [commitNow]
  )

  // Both flush any edit still inside the debounce window onto the stack
  // first: a user who types and immediately presses Cmd+Z expects that
  // keystroke undone, not skipped over (or, with nothing committed yet,
  // nothing to happen at all while the edit quietly stops being undoable).
  const undo = useCallback(() => {
    commitNow()
    const past = pastRef.current
    if (past.length === 0) return
    const previous = past.pop()!
    futureRef.current.push(lastCommittedRef.current)
    lastCommittedRef.current = previous
    latestRef.current = previous
    setStateInner(previous)
    triggerRender()
    updateHistoryState()
  }, [commitNow, triggerRender, updateHistoryState])

  const redo = useCallback(() => {
    commitNow()
    const future = futureRef.current
    if (future.length === 0) return
    const next = future.pop()!
    pastRef.current.push(lastCommittedRef.current)
    lastCommittedRef.current = next
    latestRef.current = next
    setStateInner(next)
    triggerRender()
    updateHistoryState()
  }, [commitNow, triggerRender, updateHistoryState])

  const reset = useCallback((newState: T) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    pastRef.current = []
    futureRef.current = []
    lastCommittedRef.current = newState
    latestRef.current = newState
    setStateInner(newState)
    triggerRender()
    updateHistoryState()
  }, [triggerRender, updateHistoryState])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Cmd+Z / Cmd+Shift+Z — works canvas-wide, including while editing inline text.
  // Native inputs/textareas keep their built-in undo so kit-name & search behave naturally.
  // So do TipTap fields (`.ProseMirror`): they carry their own history, and
  // taking the shortcut here as well undid twice, blurred the field, and left
  // the next Backspace deleting the whole selected block instead of a character.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const target = e.target as HTMLElement | null
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (target?.closest?.('.ProseMirror')) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (target?.isContentEditable) (target as HTMLElement).blur()
        undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        if (target?.isContentEditable) (target as HTMLElement).blur()
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
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    reset,
  }
}
