'use client';

/**
 * The canvas's copy of the Turn on pre-flight (Task 34).
 *
 * The verdict needs the server-only action registry, so the canvas asks
 * the server (`templatePreflightAction`) rather than computing it. It asks
 * again a moment after the steps change, and when the caller says a save
 * has landed (`refresh`), so a badge clears once the step is finished.
 *
 * Display only: Turn on is gated on the server whatever this says.
 *
 * @module app/(dashboard)/workflows/[id]/use-template-preflight
 */

import { useCallback, useEffect, useState } from 'react';

import type { PreflightProblem } from '@/lib/workflows/preflight';

import { templatePreflightAction } from '../actions';

/** Long enough for a burst of edits to settle into one read. */
const SETTLE_MS = 400;

/** What {@link useTemplatePreflight} returns. */
export interface TemplatePreflight {
  /** The unfinished steps; null until the first answer, or when unreadable. */
  problems: PreflightProblem[] | null;
  /** Ask again, e.g. once a write the step list does not show has landed. */
  refresh: () => void;
}

/**
 * @param templateId - the template on the canvas
 * @param steps - the canvas's step rows; a new array means "ask again"
 */
export function useTemplatePreflight(templateId: string, steps: readonly unknown[]): TemplatePreflight {
  const [problems, setProblems] = useState<PreflightProblem[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void templatePreflightAction({ templateId }).then((res) => {
        if (cancelled) return;
        // An unreadable check shows no badges rather than stale ones.
        setProblems(res.ok ? res.data.problems : null);
      });
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [templateId, steps, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { problems, refresh };
}
