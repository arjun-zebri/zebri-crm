'use client'

import { useSyncExternalStore } from 'react'

// Tailwind's `md` breakpoint. The canvas needs both a pointer that can
// drag precisely and room for a 380px card beside its neighbours;
// below this it has neither.
const QUERY = '(max-width: 767px)'

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * True on a phone-width viewport.
 *
 * Server-renders as false so the desktop canvas is what hydrates on a
 * desktop; a phone flips to the list on its first client render.
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
