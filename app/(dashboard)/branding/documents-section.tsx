'use client'

import { Clock, FileSignature, FileText, MessageSquare, Receipt, Users2 } from 'lucide-react'
import { useState } from 'react'

import type { SurfaceTab } from '@/types/branding-preview'

interface Surface {
  id: SurfaceTab
  label: string
  description: string
  icon: typeof FileText
}

const SURFACES: Surface[] = [
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
    // No card and no heading of its own: this renders inside the tab strip's
    // settings popover, which supplies both. Nesting a bordered card inside a
    // bordered popover was a box inside a box with the title said twice.
    <div className="space-y-0.5">
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
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-control transition cursor-pointer text-left ${
                isLastEnabled
                  ? 'opacity-50 cursor-not-allowed'
                  : armed
                    ? 'bg-red-50 hover:bg-red-100'
                    : 'hover:bg-gray-50'
              }`}
              title={isLastEnabled ? 'At least one surface must remain enabled' : ''}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => {}}
                disabled={isLastEnabled}
                className="accent-black cursor-pointer shrink-0 w-3.5 h-3.5"
                aria-label={`Toggle ${surface.label}`}
                tabIndex={-1}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium leading-tight ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                  {surface.label}
                </p>
                <p className={`text-[10px] leading-tight truncate ${armed ? 'text-red-500' : 'text-gray-400'}`}>
                  {armed ? 'Hide and clear this design?' : surface.description}
                </p>
              </div>
            </button>
          )
        })}
    </div>
  )
}
