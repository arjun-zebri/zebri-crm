'use client'

import { useEffect, useState } from 'react'

/** Options for {@link usePreviewScript}. */
export interface PreviewScriptOptions {
  /** Total number of beats in the sequence. */
  beats: number
  /** True when this preview's step is on screen. */
  active: boolean
  /** True when the user prefers reduced motion. */
  reducedMotion: boolean
  /** Milliseconds per beat. Default 1200. */
  beatMs?: number
}

/**
 * Drives a preview's animation as a monotonic beat counter.
 *
 * Beats advance while the step is active and then rest on the final frame.
 * There is no looping: a looping animation behind a Next button competes
 * with the button for attention.
 */
export function usePreviewScript({
  beats,
  active,
  reducedMotion,
  beatMs = 1200,
}: PreviewScriptOptions): number {
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    if (!active) {
      setBeat(0)
      return
    }
    if (reducedMotion) {
      setBeat(beats - 1)
      return
    }
    setBeat(0)
    const id = setInterval(() => {
      setBeat((b) => (b >= beats - 1 ? b : b + 1))
    }, beatMs)
    return () => clearInterval(id)
  }, [active, reducedMotion, beats, beatMs])

  return beat
}
