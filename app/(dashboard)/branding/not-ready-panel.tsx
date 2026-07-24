'use client'

import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import type { SurfaceReadiness } from '@/lib/branding/readiness'

/**
 * A yellow warning badge pinned to the top-right of the canvas, naming what is
 * still missing before the document can be sent. Noticeable but out of the way
 * (it floats over the canvas corner). Uses the app's amber warning palette,
 * consistent with other warning banners.
 *
 * A chevron signals it expands. On desktop the details reveal on hover; on
 * touch (no hover) tapping the pill toggles them open. Returns null when the
 * surface is ready (ready=true and issues.length=0). Positions itself
 * absolutely, so its host must render it inside a positioned container (the
 * CanvasFrame overlay slot).
 *
 * @param readiness - The surface readiness state: { ready, issues }.
 * @returns JSX element or null.
 */
export function NotReadyPanel({ readiness }: { readiness: SurfaceReadiness }) {
  // Tap-to-toggle for touch devices, which have no hover.
  const [open, setOpen] = useState(false)

  // Render nothing when fully ready.
  if (readiness.ready && readiness.issues.length === 0) {
    return null
  }

  // Compact always-visible pill so it never covers the document. The details
  // sit absolutely below the pill (out of flow) so the group's hover area is
  // just the pill itself, not the hidden details region.
  return (
    <div className="group absolute top-3 right-3 z-20 w-max">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Hover or tap to see what's missing"
        className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 shadow-sm cursor-pointer"
      >
        <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0 text-amber-500" />
        <span className="text-xs font-semibold text-amber-900">Not ready to send</span>
        {/* Desktop has hover, so show a hint; touch has no hover, so show the
            chevron and let a tap toggle the details. */}
        <span className="hidden text-xs font-medium text-amber-600 md:inline">
          hover to see more
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          className={`shrink-0 text-amber-500 transition-transform md:hidden ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`absolute right-0 top-full mt-1.5 w-64 max-w-[80vw] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-md transition-opacity duration-150 group-hover:opacity-100 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
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
