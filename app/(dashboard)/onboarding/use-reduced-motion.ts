'use client'

import { useEffect, useState } from 'react'

/**
 * True when the user has asked for reduced motion.
 *
 * Defaults to false so the animation runs in environments without
 * matchMedia (jsdom), which keeps the previews testable.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
