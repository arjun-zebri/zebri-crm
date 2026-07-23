'use client'

import { AlertCircle } from 'lucide-react'

import type { SurfaceReadiness } from '@/lib/branding/readiness'

/**
 * Renders a calm alert panel listing readiness issues that block editing or sending.
 *
 * Returns null when the surface is ready (ready=true and issues.length=0).
 * Otherwise renders a muted panel with an AlertCircle icon and each issue message.
 *
 * @param readiness - The surface readiness state: { ready, issues }.
 * @returns JSX element or null.
 */
export function NotReadyPanel({ readiness }: { readiness: SurfaceReadiness }) {
  // Render nothing when fully ready.
  if (readiness.ready && readiness.issues.length === 0) {
    return null
  }

  // Render the alert panel if there are any issues (Layer A or Layer B).
  return (
    <div className="mx-4 mb-4 p-4 bg-surface-muted border border-border rounded-xl">
      <div className="flex items-start gap-3">
        <AlertCircle
          size={20}
          strokeWidth={1.5}
          className="text-text-muted flex-shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text mb-2">Not ready to send</h3>
          <ul className="space-y-1">
            {readiness.issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-text-muted">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
