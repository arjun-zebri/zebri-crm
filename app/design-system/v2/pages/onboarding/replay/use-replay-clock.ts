'use client';

import { useEffect, useRef, useState } from 'react';

import { STEPS } from './replay-data';

/**
 * The replay's clock. Each step is a short scene: the card arrives
 * and settles, then its details land on four beats 0.9s apart (the
 * first beat is the scene's action), then it holds so the result can
 * be read. It plays once, about fifty seconds, and stops on
 * the booking. Everything on screen is derived from the elapsed time,
 * so jumping or scrubbing to any point is just setting it.
 *
 * @module app/design-system/v2/pages/onboarding/replay/use-replay-clock
 */

/** How many steps the replay walks through. */
export const STEP_COUNT = STEPS.length;
/** One scene, in ms: 0.8s to arrive, four beats 0.9s apart, then a hold. */
export const SCENE_MS = 5200;
/** When each beat lands, from the start of its scene. */
const BEATS = [800, 1700, 2600, 3500];
/** The whole replay. */
export const TOTAL_MS = STEP_COUNT * SCENE_MS;
const TICK_MS = 50;

export interface ReplayClock {
  /** The step on screen, from 0. */
  step: number;
  /** How far through its scene, 0 to 1. */
  progress: number;
  playing: boolean;
  /** Played through to the booking. */
  ended: boolean;
  /** Whether beat `k` of step `i` has landed yet. */
  on: (i: number, k: number) => boolean;
  /** Pause, play, or from the end, play again from the top. */
  toggle: () => void;
  /** Jump to the start of step `i` and play from there. */
  jump: (i: number) => void;
  /** Move to a point in the whole replay, 0 to 1, keeping play or pause as it is. */
  seek: (fraction: number) => void;
}

/** Runs only while `active`, so a step that is not on screen stays still. */
export function useReplayClock(active: boolean): ReplayClock {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ended = elapsed >= TOTAL_MS;
  const last = useRef(0);

  useEffect(() => {
    if (!active || !playing || ended) return;
    // Measured, not counted: timers drift, and a paused tab fires late.
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last.current, 250);
      last.current = now;
      setElapsed((e) => Math.min(TOTAL_MS, e + dt));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, playing, ended]);

  const step = Math.min(STEP_COUNT - 1, Math.floor(elapsed / SCENE_MS));
  const into = elapsed - step * SCENE_MS;
  return {
    step,
    progress: Math.min(1, into / SCENE_MS),
    playing: playing && !ended,
    ended,
    on: (i, k) => step > i || (step === i && into >= (BEATS[k] ?? Infinity)),
    toggle: () => {
      if (ended) {
        setElapsed(0);
        setPlaying(true);
      } else setPlaying((p) => !p);
    },
    jump: (i) => {
      setElapsed(i * SCENE_MS);
      setPlaying(true);
    },
    seek: (fraction) => setElapsed(Math.min(1, Math.max(0, fraction)) * TOTAL_MS),
  };
}
