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
  // Replay contract: reactivation restarts from beat 0. Resetting during
  // render (not in an effect) avoids a cascading second render pass.
  const [prevActive, setPrevActive] = useState(active)
  if (active !== prevActive) {
    setPrevActive(active)
    setBeat(0)
  }

  useEffect(() => {
    if (!active || reducedMotion) return
    const id = setInterval(() => {
      setBeat((b) => (b >= beats - 1 ? b : b + 1))
    }, beatMs)
    return () => clearInterval(id)
  }, [active, reducedMotion, beats, beatMs])

  if (!active) return 0
  if (reducedMotion) return beats - 1
  return beat
}

/**
 * A content clock that trails the cursor clock by {@link delayMs}.
 *
 * The pointer glides to a control at the start of a beat; the button must
 * not highlight (and the menu must not open) until the pointer has actually
 * arrived. Driving the visuals off this trailing value — rather than the raw
 * beat — makes every click land under the cursor instead of ahead of it.
 *
 * Returns the beat immediately when there is nothing to wait for (first
 * render, reduced motion), so the resting frame is never delayed.
 */
export function useSettledBeat(beat: number, delayMs = 520): number {
  const [settled, setSettled] = useState(beat)
  useEffect(() => {
    if (settled === beat) return
    const id = setTimeout(() => setSettled(beat), delayMs)
    return () => clearTimeout(id)
  }, [beat, settled, delayMs])
  return settled
}
