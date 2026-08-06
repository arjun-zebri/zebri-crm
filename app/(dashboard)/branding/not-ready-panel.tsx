'use client';

import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import type { SurfaceReadiness } from '@/lib/branding/readiness';

/**
 * A yellow warning badge pinned to the top-right of the canvas, naming what is
 * still missing before the document can be sent. Noticeable but out of the way
 * (it floats over the canvas corner). Uses the app's amber warning palette,
 * consistent with other warning banners.
 *
 * A chevron on the right signals it expands; clicking the pill toggles a
 * dropdown listing the missing blocks. No hover. Returns null when the surface
 * is ready (ready=true and issues.length=0). Positions itself absolutely, so
 * its host must render it inside a positioned container (the CanvasFrame
 * overlay slot).
 *
 * @param readiness - The surface readiness state: { ready, issues }.
 * @returns JSX element or null.
 */
export function NotReadyPanel({ readiness }: { readiness: SurfaceReadiness }) {
  // Click-to-toggle the dropdown (no hover).
  const [open, setOpen] = useState(false);

  // Render nothing when fully ready.
  if (readiness.ready && readiness.issues.length === 0) {
    return null;
  }

  // Compact pill so it never covers the document. The dropdown sits absolutely
  // below the pill (out of flow) and shows only when clicked open.
  return (
    <div className="absolute top-3 right-3 z-20 w-max">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-pill border border-amber-200 bg-amber-50 px-3 py-1 shadow-sm cursor-pointer"
      >
        <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0 text-amber-500" />
        <span className="text-caption font-semibold text-amber-900">Not ready to send</span>
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          className={`shrink-0 text-amber-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        hidden={!open}
        className="absolute right-0 top-full mt-1.5 w-64 max-w-[80vw] rounded-control border border-amber-200 bg-amber-50 px-3 py-2 shadow-md"
      >
        <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-500">
          {readiness.issues.map((issue, idx) => (
            <li key={idx} className="text-caption leading-snug text-amber-800">
              {issue.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
