'use client'

import { useEffect, useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { extractColorsFromFile } from '@/lib/branding/extract-colors'
import {
  FONT_LABELS,
  type HeadingFont,
  type BodyFont,
} from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'

/**
 * Props for the visual look step.
 * @internal
 */
interface StepLookProps {
  logoUrl: string
  brandColor: string
  setBrandColor: (v: string) => void
  fontHeading: HeadingFont
  setFontHeading: (v: HeadingFont) => void
  fontBody: BodyFont
  setFontBody: (v: BodyFont) => void
  density: Density
  setDensity: (v: Density) => void
}

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
 * StepLook — Select brand color, font pairing, and density.
 *
 * Color: input + 4 suggested swatches from logo if uploaded.
 * Fonts: 3 curated pairings as radio cards.
 * Density: 3 radio cards (compact, cozy, roomy) with spacing glyphs.
 * @internal
 */
export function StepLook(props: StepLookProps) {
  const [suggestedColors, setSuggestedColors] = useState<string[]>([])
  const [loadingColors, setLoadingColors] = useState(false)

  /**
   * Extract suggested colors from logo on mount or when logoUrl changes.
   */
  useEffect(() => {
    const extract = async () => {
      if (!props.logoUrl) {
        setSuggestedColors([])
        return
      }

      setLoadingColors(true)
      try {
        // Fetch the logo as a blob so we can convert to File for extraction
        const res = await fetch(props.logoUrl)
        const blob = await res.blob()
        const file = new File([blob], 'logo.png', { type: blob.type })
        const colors = await extractColorsFromFile(file, 4)
        setSuggestedColors(colors)
      } catch {
        // Silently fail; suggest colors are optional
        setSuggestedColors([])
      } finally {
        setLoadingColors(false)
      }
    }

    extract()
  }, [props.logoUrl])

  /**
   * Find current pairing by heading/body combination.
   */
  const currentPairingName = FONT_PAIRINGS.find(
    (p) => p.heading === props.fontHeading && p.body === props.fontBody,
  )?.name

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-text mb-4">Choose your look</h2>
        <p className="text-sm text-text-muted">Brand color, fonts, and spacing.</p>
      </div>

      <div className="space-y-4">
        {/* Brand color */}
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Brand color</label>
          <div className="flex items-center gap-3">
            <ColorPopover
              value={props.brandColor}
              onChange={props.setBrandColor}
              trigger={
                <button
                  type="button"
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-brand/50 transition"
                  style={{ backgroundColor: props.brandColor }}
                  aria-label="Pick brand color"
                />
              }
              align="start"
            />
            <input
              type="text"
              value={props.brandColor}
              onChange={(e) => props.setBrandColor(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Brand color hex"
            />
          </div>

          {/* Suggested colors from logo */}
          {suggestedColors.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-muted">From logo:</span>
              {suggestedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => props.setBrandColor(color)}
                  className="w-6 h-6 rounded-lg border border-border cursor-pointer hover:ring-1 hover:ring-brand/50 transition"
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Use color ${color}`}
                />
              ))}
            </div>
          )}
          {loadingColors && <p className="mt-2 text-xs text-text-muted">Extracting colors...</p>}
        </div>

        {/* Font pairing */}
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

        {/* Density */}
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
