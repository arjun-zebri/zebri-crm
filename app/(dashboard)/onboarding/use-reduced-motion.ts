'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  // jsdom has no matchMedia; defaulting to false keeps previews testable.
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * True when the user has asked for reduced motion.
 *
 * Defaults to false in environments without matchMedia (jsdom), which
 * keeps the previews testable.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
