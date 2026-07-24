'use client'

import { AlertTriangle } from 'lucide-react'

import type { SurfaceReadiness } from '@/lib/branding/readiness'

/**
 * A yellow warning badge pinned to the top-right of the canvas, naming what is
 * still missing before the document can be sent. Noticeable but out of the way
 * (it floats over the canvas corner). Uses the app's amber warning palette,
 * consistent with other warning banners.
 *
 * Returns null when the surface is ready (ready=true and issues.length=0).
 * Positions itself absolutely, so its host must render it inside a positioned
 * container (the CanvasFrame overlay slot).
 *
 * @param readiness - The surface readiness state: { ready, issues }.
 * @returns JSX element or null.
 */
export function NotReadyPanel({ readiness }: { readiness: SurfaceReadiness }) {
  // Render nothing when fully ready.
  if (readiness.ready && readiness.issues.length === 0) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-20 max-w-[280px] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} strokeWidth={1.5} className="shrink-0 mt-0.5 text-amber-500" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-900">Not ready to send</p>
          <ul className="mt-1 space-y-0.5">
            {readiness.issues.map((issue, idx) => (
              <li key={idx} className="text-xs leading-snug text-amber-800">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
