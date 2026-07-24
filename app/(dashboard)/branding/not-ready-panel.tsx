'use client'

import { AlertCircle } from 'lucide-react'

import type { SurfaceReadiness } from '@/lib/branding/readiness'

/**
 * A quiet, inline readiness note naming what is still missing before the
 * document can be sent. Intentionally low-emphasis: no panel, border, or
 * background, small muted text, a small icon. It informs without alarming,
 * matching the editor's calm tone.
 *
 * Returns null when the surface is ready (ready=true and issues.length=0).
 *
 * @param readiness - The surface readiness state: { ready, issues }.
 * @returns JSX element or null.
 */
export function NotReadyPanel({ readiness }: { readiness: SurfaceReadiness }) {
  // Render nothing when fully ready.
  if (readiness.ready && readiness.issues.length === 0) {
    return null
  }

  // A single quiet muted line. Each issue message stays its own <span> so the
  // messages read as running text but remain individually addressable.
  return (
    <div className="mx-4 mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-text-subtle">
      <AlertCircle size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" />
      <p>
        {readiness.issues.map((issue, idx) => (
          <span key={idx}>
            {idx > 0 ? ' ' : ''}
            {issue.message}
          </span>
        ))}
      </p>
    </div>
  )
}
