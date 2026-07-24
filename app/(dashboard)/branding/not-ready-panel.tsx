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

  // Compact always-visible pill so it never covers the document. The details
  // sit absolutely below the pill (out of flow) so the group's hover area is
  // just the pill itself, not the hidden details region.
  return (
    <div className="group absolute top-3 right-3 z-20 w-max">
      <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 shadow-sm cursor-help">
        <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0 text-amber-500" />
        <span className="text-xs font-semibold text-amber-900">Not ready to send</span>
      </div>
      <div className="pointer-events-none absolute right-0 top-full mt-1.5 w-64 max-w-[80vw] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        <ul className="space-y-0.5">
          {readiness.issues.map((issue, idx) => (
            <li key={idx} className="text-xs leading-snug text-amber-800">
              {issue.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
