'use client'

import { useEffect, useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { extractColorsFromFile } from '@/lib/branding/extract-colors'
import type { HeadingFont, BodyFont } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'

import { FontPairingPicker, DensityPicker } from './look-pickers'

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-text mb-1">Choose your look</h2>
        <p className="text-sm text-text-muted">Brand color, fonts, and spacing.</p>
      </div>

      <div className="space-y-4">
        {/* Brand color */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-2">Brand color</label>
          <div className="flex items-center gap-3">
            <ColorPopover
              value={props.brandColor}
              onChange={props.setBrandColor}
              trigger={
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-brand/50 transition"
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
              className="flex-1 h-8 text-xs px-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
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

        {/* Font pairing and density pickers */}
        <FontPairingPicker
          fontHeading={props.fontHeading}
          setFontHeading={props.setFontHeading}
          fontBody={props.fontBody}
          setFontBody={props.setFontBody}
        />

        <DensityPicker
          density={props.density}
          setDensity={props.setDensity}
        />
      </div>
    </div>
  )
}
