'use client'

import { Clock, Eye, EyeOff, FileSignature, FileText, MessageSquare, Receipt, Users2 } from 'lucide-react'
import { useState } from 'react'

import type { SurfaceTab } from '@/types/branding-preview'

interface Surface {
  id: SurfaceTab
  label: string
  description: string
  icon: typeof FileText
}

const SURFACES: Surface[] = [
  { id: 'proposal', label: 'Proposals', description: 'Priced packages couples accept online', icon: FileText },
  { id: 'invoice', label: 'Invoices', description: 'Card and bank-transfer payments', icon: Receipt },
  { id: 'contract', label: 'Contracts', description: 'E-sign agreements', icon: FileSignature },
  { id: 'portal', label: 'Client portal', description: 'The couple\'s home for everything', icon: Users2 },
  { id: 'vendorTimeline', label: 'Run sheet', description: 'Vendor-facing day-of timeline', icon: Clock },
  { id: 'questionnaire', label: 'Questionnaires', description: 'Collect details from couples', icon: MessageSquare },
]

interface DocumentsSectionProps {
  enabledSurfaces: SurfaceTab[]
  onToggleSurface: (surface: SurfaceTab, enabled: boolean) => void
}

/**
 * Documents section: toggles for enabling/disabling each branding surface.
 *
 * Uses armed-confirm pattern for disabling: first click arms the confirmation,
 * second click disables. At least one surface must remain enabled.
 */
export function DocumentsSection({ enabledSurfaces, onToggleSurface }: DocumentsSectionProps) {
  const [armedSurface, setArmedSurface] = useState<SurfaceTab | null>(null)

  const handleToggle = (surface: SurfaceTab) => {
    const isEnabled = enabledSurfaces.includes(surface)

    if (isEnabled) {
      // If disabling, check if this is the last enabled surface
      if (enabledSurfaces.length === 1) {
        // Cannot disable the last surface; do nothing
        return
      }

      if (armedSurface === surface) {
        // Second click: confirm disable
        onToggleSurface(surface, false)
        setArmedSurface(null)
      } else {
        // First click: arm the disable
        setArmedSurface(surface)
      }
    } else {
      // Enabling: just toggle on
      onToggleSurface(surface, true)
      setArmedSurface(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text mb-3">Documents</p>
      <div className="space-y-2">
        {SURFACES.map((surface) => {
          const enabled = enabledSurfaces.includes(surface.id)
          const armed = armedSurface === surface.id
          const isLastEnabled = enabledSurfaces.length === 1 && enabled

          return (
            <button
              key={surface.id}
              type="button"
              onClick={() => handleToggle(surface.id)}
              disabled={isLastEnabled}
              className={`w-full flex items-start gap-3 p-3 rounded-lg transition cursor-pointer text-left ${
                isLastEnabled
                  ? 'bg-surface-muted opacity-60 cursor-not-allowed'
                  : armed
                    ? 'bg-red-50 hover:bg-red-100'
                    : enabled
                      ? 'hover:bg-surface-muted'
                      : 'hover:bg-surface-muted'
              }`}
              title={isLastEnabled ? 'At least one surface must remain enabled' : ''}
            >
              <div className="mt-0.5">
                {enabled ? (
                  <Eye size={16} strokeWidth={1.5} className="text-text" />
                ) : (
                  <EyeOff size={16} strokeWidth={1.5} className="text-text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${enabled ? 'text-text' : 'text-text-muted'}`}>
                  {surface.label}
                </p>
                <p className="text-xs text-text-muted leading-snug">
                  {armed ? 'Hide and clear this design?' : surface.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => {}}
                disabled={isLastEnabled}
                className="mt-0.5 accent-black cursor-pointer"
                aria-label={`Toggle ${surface.label}`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
