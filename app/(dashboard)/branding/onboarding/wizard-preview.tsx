'use client'

import { getTextColor } from '@/lib/branding/contrast'
import { FONT_STACKS, type BodyFont, type HeadingFont } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'
import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Props for the live wizard preview pane.
 * @internal
 */
interface WizardPreviewProps {
  businessName: string
  tagline: string
  logoUrl: string
  brandColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  enabledSurfaces: SurfaceTab[]
  /** Current wizard step; step 3 highlights the document list. */
  step: 1 | 2 | 3
}

/** Vertical rhythm inside the mini document per density choice. */
const DENSITY_GAP: Record<Density, number> = { compact: 6, cozy: 10, roomy: 14 }

const SURFACE_LABELS: ReadonlyArray<[SurfaceTab, string]> = [
  ['proposal', 'Proposals'],
  ['invoice', 'Invoices'],
  ['contract', 'Contracts'],
  ['portal', 'Client portal'],
  ['vendorTimeline', 'Run sheet'],
  ['questionnaire', 'Questionnaires'],
]

/**
 * WizardPreview: a miniature document that live-updates with the wizard's
 * current choices, so each option's effect is visible the moment it changes.
 *
 * Deliberately a mock, not a real block render: at this size a faithful
 * document would be unreadable, while a logo + name in the chosen fonts, a
 * brand-colored accept button, and density-spaced placeholder lines
 * communicate exactly what each control does. Step 3 adds the six document
 * types with their on/off state so the toggles have visible consequences.
 * @internal
 */
export function WizardPreview(props: WizardPreviewProps) {
  const gap = DENSITY_GAP[props.density]
  const name = props.businessName.trim() || 'Your business'
  const monogram = name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-[11px] uppercase tracking-wide text-text-subtle">Live preview</p>

      {/* Mini document mock. */}
      <div className="rounded-lg border border-border bg-white shadow-sm p-4">
        <div className="flex items-center gap-2.5">
          {props.logoUrl ? (
            // User-uploaded brand asset, plain img by convention.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: props.brandColor, color: getTextColor(props.brandColor) }}
            >
              {monogram}
            </span>
          )}
          <div className="min-w-0">
            <p
              className="text-sm leading-tight truncate text-gray-900"
              style={{ fontFamily: FONT_STACKS[props.fontHeading] }}
            >
              {name}
            </p>
            {props.tagline.trim() && (
              <p
                className="text-[11px] leading-tight truncate text-gray-500"
                style={{ fontFamily: FONT_STACKS[props.fontBody] }}
              >
                {props.tagline}
              </p>
            )}
          </div>
        </div>

        {/* Placeholder copy whose rhythm follows the density choice. */}
        <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap }}>
          <div className="h-1.5 rounded-full bg-gray-200 w-full" />
          <div className="h-1.5 rounded-full bg-gray-200 w-11/12" />
          <div className="h-1.5 rounded-full bg-gray-100 w-2/3" />
        </div>

        <div
          className="mt-4 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
          style={{
            background: props.brandColor,
            color: getTextColor(props.brandColor),
            fontFamily: FONT_STACKS[props.fontBody],
          }}
        >
          Accept proposal
        </div>
      </div>

      {/* Document types, so step 3's toggles have visible consequences. */}
      <div className={`transition-opacity duration-300 ${props.step === 3 ? 'opacity-100' : 'opacity-60'}`}>
        <p className="text-[11px] uppercase tracking-wide text-text-subtle mb-2">Your documents</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {SURFACE_LABELS.map(([key, label]) => {
            const on = props.enabledSurfaces.includes(key)
            return (
              <li key={key} className={`flex items-center gap-1.5 text-xs ${on ? 'text-text' : 'text-text-subtle line-through'}`}>
                <span
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-brand-fg' : 'border border-border'}`}
                />
                {label}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
