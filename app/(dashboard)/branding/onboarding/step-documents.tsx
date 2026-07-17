'use client'

import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Props for the documents step.
 * @internal
 */
interface StepDocumentsProps {
  enabledSurfaces: SurfaceTab[]
  setEnabledSurfaces: (v: SurfaceTab[]) => void
}

/**
 * Surface description: label and help text.
 * @internal
 */
interface SurfaceDescription {
  label: string
  description: string
}

/**
 * Surface descriptions for the onboarding step.
 */
const SURFACES: Record<SurfaceTab, SurfaceDescription> = {
  proposal: {
    label: 'Proposals',
    description: 'Priced packages couples accept online',
  },
  invoice: {
    label: 'Invoices',
    description: 'Card and bank transfer payments',
  },
  contract: {
    label: 'Contracts',
    description: 'E-sign agreements',
  },
  portal: {
    label: 'Client portal',
    description: 'The couple home for everything',
  },
  vendorTimeline: {
    label: 'Run sheet',
    description: 'Vendor-facing day-of timeline',
  },
  questionnaire: {
    label: 'Questionnaires',
    description: 'Collect details from couples',
  },
}

/**
 * Ordered list of all surfaces for consistent display.
 */
const SURFACE_ORDER: SurfaceTab[] = [
  'proposal',
  'invoice',
  'contract',
  'portal',
  'vendorTimeline',
  'questionnaire',
]

/**
 * StepDocuments — Choose which document surfaces to enable.
 *
 * All start ON; at least one must stay enabled (finish disabled otherwise).
 * @internal
 */
export function StepDocuments(props: StepDocumentsProps) {
  /**
   * Toggle surface on/off, but enforce at least one enabled.
   */
  const toggleSurface = (surface: SurfaceTab) => {
    if (props.enabledSurfaces.includes(surface)) {
      // Don't allow disabling if it's the only one
      if (props.enabledSurfaces.length === 1) return
      props.setEnabledSurfaces(props.enabledSurfaces.filter((s) => s !== surface))
    } else {
      props.setEnabledSurfaces([...props.enabledSurfaces, surface])
    }
  }

  const allDisabledExceptOne = props.enabledSurfaces.length === 1

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-text mb-1">Which documents?</h2>
        <p className="text-sm text-text-muted">You can change these later. At least one must be enabled.</p>
      </div>

      <div className="space-y-2">
        {SURFACE_ORDER.map((surface) => {
          const enabled = props.enabledSurfaces.includes(surface)
          const isOnlyEnabled = enabled && allDisabledExceptOne
          const info = SURFACES[surface]

          return (
            <label
              key={surface}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                enabled
                  ? 'border-border-strong bg-surface-muted'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleSurface(surface)}
                disabled={isOnlyEnabled}
                className="accent-black cursor-pointer disabled:opacity-50 disabled:cursor-default"
                aria-label={info.label}
              />
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="text-sm font-medium text-text shrink-0">{info.label}</span>
                <span className="text-xs text-text-muted truncate">{info.description}</span>
              </div>
            </label>
          )
        })}
      </div>

      {allDisabledExceptOne && (
        <p className="text-xs text-text-muted">Keep at least one document type enabled.</p>
      )}
    </div>
  )
}
