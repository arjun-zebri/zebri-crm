'use client'

import { useEffect, useState } from 'react'

import { extractColorsFromFile } from '@/lib/branding/extract-colors'
import { BODY_FONTS, FONT_LABELS, HEADING_FONTS, type BodyFont, type HeadingFont } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'

import { Select } from '../components/select'

import { ColorField, DensityPicker, RadiusPicker } from './look-pickers'

/**
 * Props for the visual look step.
 * @internal
 */
interface StepLookProps {
  logoUrl: string
  brandColor: string
  setBrandColor: (v: string) => void
  secondaryColor: string
  setSecondaryColor: (v: string) => void
  fontHeading: HeadingFont
  setFontHeading: (v: HeadingFont) => void
  fontBody: BodyFont
  setFontBody: (v: BodyFont) => void
  density: Density
  setDensity: (v: Density) => void
  cornerRadius: number
  setCornerRadius: (v: number) => void
}

const HEADING_OPTIONS = HEADING_FONTS.map((f) => ({ value: f, label: FONT_LABELS[f] }))
const BODY_OPTIONS = BODY_FONTS.map((f) => ({ value: f, label: FONT_LABELS[f] }))

/**
 * StepLook: primary and secondary brand colours, heading and body fonts,
 * spacing density, and corner radius. Suggested swatches from the uploaded
 * logo feed the primary colour.
 * @internal
 */
export function StepLook(props: StepLookProps) {
  const [suggestedColors, setSuggestedColors] = useState<string[]>([])
  const [loadingColors, setLoadingColors] = useState(false)

  /** Extract suggested colours from the logo when it changes. */
  useEffect(() => {
    const extract = async () => {
      if (!props.logoUrl) {
        setSuggestedColors([])
        return
      }
      setLoadingColors(true)
      try {
        const res = await fetch(props.logoUrl)
        const blob = await res.blob()
        const file = new File([blob], 'logo.png', { type: blob.type })
        setSuggestedColors(await extractColorsFromFile(file, 4))
      } catch {
        // Suggestions are optional; fail quietly.
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
        <p className="text-sm text-text-muted">Colours, fonts, spacing, and corners.</p>
      </div>

      <div className="space-y-4">
        {/* Brand colours */}
        <div>
          <div className="flex gap-3">
            <ColorField label="Primary colour" value={props.brandColor} onChange={props.setBrandColor} />
            <ColorField label="Secondary colour" value={props.secondaryColor} onChange={props.setSecondaryColor} />
          </div>

          {suggestedColors.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xs text-text-muted">From logo:</span>
              {suggestedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => props.setBrandColor(color)}
                  className="w-6 h-6 rounded-lg border border-border cursor-pointer hover:ring-1 hover:ring-brand/50 transition"
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Use colour ${color}`}
                />
              ))}
            </div>
          )}
          {loadingColors && <p className="mt-2 text-xs text-text-muted">Extracting colours...</p>}
        </div>

        {/* Fonts */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-text-muted mb-2">Heading font</label>
            <Select value={props.fontHeading} options={HEADING_OPTIONS} onChange={props.setFontHeading} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-text-muted mb-2">Body font</label>
            <Select value={props.fontBody} options={BODY_OPTIONS} onChange={props.setFontBody} size="sm" />
          </div>
        </div>

        <DensityPicker density={props.density} setDensity={props.setDensity} />

        <RadiusPicker cornerRadius={props.cornerRadius} setCornerRadius={props.setCornerRadius} />
      </div>
    </div>
  )
}
