'use client'

import type { HeadingFont, BodyFont } from '@/lib/branding/fonts'
import { FONT_LABELS, FONT_STACKS } from '@/lib/branding/fonts'
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

/** Curated font pairings for onboarding. */
const FONT_PAIRINGS: FontPairing[] = [
  { name: 'Serif classic', heading: 'playfair', body: 'inter' },
  { name: 'Modern', heading: 'inter', body: 'inter' },
  { name: 'Editorial', heading: 'dm_serif', body: 'source_sans' },
]

/** Shared row/tile styling for the two pickers; single-width border so
 *  selection never shifts layout. */
const OPTION_CLASSES = (selected: boolean) =>
  `rounded-lg border cursor-pointer transition ${
    selected ? 'border-border-strong bg-surface-muted' : 'border-border hover:border-border-strong'
  }`

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
 * FontPairingPicker: three curated pairings. Each row renders its own name
 * in the pairing's heading font, so the choice is visible in place instead
 * of described.
 * @internal
 */
export function FontPairingPicker(props: FontPairingPickerProps) {
  const currentName = FONT_PAIRINGS.find(
    (p) => p.heading === props.fontHeading && p.body === props.fontBody,
  )?.name

  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-2">Font pairing</label>
      <div className="space-y-2">
        {FONT_PAIRINGS.map((pairing) => {
          const selected = currentName === pairing.name
          return (
            <label key={pairing.name} className="block">
              <input
                type="radio"
                name="fontPairing"
                checked={selected}
                onChange={() => {
                  props.setFontHeading(pairing.heading)
                  props.setFontBody(pairing.body)
                }}
                className="sr-only"
                aria-label={pairing.name}
              />
              <div className={`flex items-baseline justify-between gap-3 px-3 py-2.5 ${OPTION_CLASSES(selected)}`}>
                <span className="text-base text-text" style={{ fontFamily: FONT_STACKS[pairing.heading] }}>
                  {pairing.name}
                </span>
                <span className="text-xs text-text-muted truncate" style={{ fontFamily: FONT_STACKS[pairing.body] }}>
                  {FONT_LABELS[pairing.heading]} + {FONT_LABELS[pairing.body]}
                </span>
              </div>
            </label>
          )
        })}
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
 * DensityPicker: spacing density as three side-by-side tiles, each with a
 * glyph whose line rhythm matches the choice.
 * @internal
 */
export function DensityPicker(props: DensityPickerProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-2">Spacing</label>
      <div className="grid grid-cols-3 gap-2">
        {(['compact', 'cozy', 'roomy'] as const).map((d) => {
          const selected = props.density === d
          return (
            <label key={d} className="block">
              <input
                type="radio"
                name="density"
                checked={selected}
                onChange={() => props.setDensity(d)}
                className="sr-only"
                aria-label={d}
              />
              <div className={`flex flex-col items-center gap-2 px-2 py-3 ${OPTION_CLASSES(selected)}`}>
                <DensityGlyph density={d} />
                <span className="text-xs font-medium text-text capitalize">{d}</span>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * DensityGlyph: three short lines whose vertical gaps mirror the density's
 * document rhythm.
 * @internal
 */
function DensityGlyph({ density }: { density: Density }) {
  const gaps: Record<Density, string> = { compact: 'gap-[3px]', cozy: 'gap-[5px]', roomy: 'gap-[8px]' }
  return (
    <div className={`flex flex-col ${gaps[density]}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-0.5 rounded-full bg-text-subtle ${i === 2 ? 'w-5' : 'w-8'}`} />
      ))}
    </div>
  )
}
