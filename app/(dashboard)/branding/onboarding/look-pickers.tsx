'use client'

import type { HeadingFont, BodyFont } from '@/lib/branding/fonts'
import { FONT_LABELS } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'

/**
 * Font pairing: heading + body combo with display name.
 * @internal
 */
interface FontPairing {
  name: string
  heading: HeadingFont
  body: BodyFont
}

/**
 * Curated font pairings for onboarding.
 */
const FONT_PAIRINGS: FontPairing[] = [
  { name: 'Serif classic', heading: 'playfair', body: 'inter' },
  { name: 'Modern', heading: 'inter', body: 'inter' },
  { name: 'Editorial', heading: 'dm_serif', body: 'source_sans' },
]

/**
 * Props for font pairing picker.
 * @internal
 */
interface FontPairingPickerProps {
  fontHeading: HeadingFont
  setFontHeading: (v: HeadingFont) => void
  fontBody: BodyFont
  setFontBody: (v: BodyFont) => void
}

/**
 * FontPairingPicker — Select from 3 curated pairings (Serif, Modern, Editorial).
 * @internal
 */
export function FontPairingPicker(props: FontPairingPickerProps) {
  const currentPairingName = FONT_PAIRINGS.find(
    (p) => p.heading === props.fontHeading && p.body === props.fontBody,
  )?.name

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">Font pairing</label>
      <div className="space-y-2">
        {FONT_PAIRINGS.map((pairing) => (
          <label
            key={`${pairing.heading}-${pairing.body}`}
            className="block relative"
          >
            <input
              type="radio"
              name="fontPairing"
              value={`${pairing.heading}-${pairing.body}`}
              checked={currentPairingName === pairing.name}
              onChange={() => {
                props.setFontHeading(pairing.heading)
                props.setFontBody(pairing.body)
              }}
              className="sr-only"
              aria-label={pairing.name}
            />
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                currentPairingName === pairing.name
                  ? 'border-brand bg-brand/5'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <div className="text-sm font-medium text-text">{pairing.name}</div>
              <div className="text-xs text-text-muted mt-1">
                {FONT_LABELS[pairing.heading]} • {FONT_LABELS[pairing.body]}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * Props for density picker.
 * @internal
 */
interface DensityPickerProps {
  density: Density
  setDensity: (v: Density) => void
}

/**
 * DensityPicker — Select spacing density (compact, cozy, roomy).
 * @internal
 */
export function DensityPicker(props: DensityPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">Spacing</label>
      <div className="space-y-2">
        {(['compact', 'cozy', 'roomy'] as const).map((d) => (
          <label key={d} className="block relative">
            <input
              type="radio"
              name="density"
              value={d}
              checked={props.density === d}
              onChange={() => props.setDensity(d)}
              className="sr-only"
              aria-label={d}
            />
            <div
              className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                props.density === d
                  ? 'border-brand bg-brand/5'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <div className="text-sm font-medium text-text capitalize">{d}</div>
              <DensityGlyph density={d} />
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * DensityGlyph — Tiny visual representation of spacing density.
 * @internal
 */
function DensityGlyph({ density }: { density: Density }) {
  const spacings = {
    compact: '2px',
    cozy: '4px',
    roomy: '6px',
  }

  const gaps = {
    compact: 'gap-0.5',
    cozy: 'gap-1',
    roomy: 'gap-1.5',
  }

  return (
    <div className={`flex items-center ${gaps[density]} mt-2`}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-1 bg-text-muted rounded-full opacity-50" style={{ width: spacings[density] }} />
      ))}
    </div>
  )
}
