'use client'

import { Check, Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { createClient } from '@/lib/supabase/client'

/**
 * Portal package selector card.
 *
 * Renders a dropdown of the MC's available (non-archived) packages with
 * the current selection preselected. OnChange saves immediately via RPC,
 * with inline Saving / error feedback matching the contact details card.
 */
export interface Package {
  id: string
  name: string
  description: string | null
  gst_inclusive: boolean
  total_amount: number
}

export interface PackageSelectorProps {
  token: string
  packages: Package[]
  selectedPackageId: string | null
  branding: PublicBranding
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Sentinel value for "no package selected". Use this instead of empty
 * string because the Select primitive crashes on value="". When the
 * control reads "none", send null to the RPC.
 */
const SENTINEL_NONE = '__none__'

export function PackageSelector({
  token,
  packages,
  selectedPackageId,
  branding,
}: PackageSelectorProps) {
  const supabase = createClient()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [localSelection, setLocalSelection] = useState(selectedPackageId ?? SENTINEL_NONE)

  const save = useCallback(
    async (packageId: string | null) => {
      setStatus('saving')
      const { error } = await supabase.rpc('save_portal_package', {
        p_token: token,
        p_package_id: packageId as unknown as string,
      })
      setStatus(error ? 'error' : 'saved')
      // Auto-dismiss the success state after 2 seconds.
      if (!error) {
        setTimeout(() => setStatus('idle'), 2000)
      }
    },
    [supabase, token],
  )

  const handleChange = (value: string) => {
    setLocalSelection(value)
    const packageId = value === SENTINEL_NONE ? null : value
    void save(packageId)
  }

  const labelDefaults = roleDefaults(branding, 'sectionLabel')
  const labelColor = labelDefaults.color
  const bodyDefaults = roleDefaults(branding, 'body')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          style={{
            fontSize: `${labelDefaults.fontSize}px`,
            color: labelColor,
            fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
            fontWeight: labelDefaults.fontWeight,
            lineHeight: labelDefaults.lineHeight,
            letterSpacing: `${labelDefaults.letterSpacing}px`,
          }}
        >
          Your package
        </label>
        <SaveIndicator status={status} branding={branding} />
      </div>

      {/* Package selector dropdown. */}
      <div>
        <select
          value={localSelection}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            fontSize: `${bodyDefaults.fontSize}px`,
            color: bodyDefaults.color ?? '#000',
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
            // The portal is a branded document surface, so colours and
            // corners come from the MC's branding, never app-chrome tokens.
            backgroundColor: branding.surface_color,
            borderColor: branding.border_color,
            borderWidth: 1,
            borderRadius: branding.corner_radius,
            outline: 'none',
          }}
          className="w-full cursor-pointer appearance-none px-3 py-2 transition-colors"
        >
          <option value={SENTINEL_NONE}>Select a package</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name} ({formatPrice(pkg.total_amount)})
            </option>
          ))}
        </select>
      </div>

      {/* Show the selected package's details if one is chosen. */}
      {localSelection !== SENTINEL_NONE && (
        (() => {
          const selected = packages.find((p) => p.id === localSelection)
          if (!selected) return null
          return (
            <div
              className="mt-2 p-3"
              style={{
                borderColor: branding.border_color,
                borderWidth: 1,
                borderRadius: branding.corner_radius,
              }}
            >
              {selected.description && (
                <p
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color ?? '#000',
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {selected.description}
                </p>
              )}
              <p
                className="mt-2"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color ?? '#000',
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: 600,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {formatPrice(selected.total_amount)}{selected.gst_inclusive ? ' (inc. GST)' : ''}
              </p>
            </div>
          )
        })()
      )}
    </div>
  )
}

/** Inline save status indicator matching contact details card. */
function SaveIndicator({ status, branding }: { status: SaveStatus; branding: PublicBranding }) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  if (status === 'saving') {
    return (
      <span
        className="flex items-center gap-1.5"
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
        Saving...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span
        className="flex items-center gap-1.5"
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: STATUS_COLORS.success,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        <Check size={12} strokeWidth={1.5} />
        Saved
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        style={{
          fontSize: `${finePrintDefaults.fontSize}px`,
          color: STATUS_COLORS.error,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
          lineHeight: finePrintDefaults.lineHeight,
        }}
      >
        Couldn&apos;t save
      </span>
    )
  }
  return null
}

/**
 * Format a numeric price as a localized string.
 *
 * @param amount - Price in base units (e.g. cents or dollars depending on currency).
 * @returns Formatted price string (e.g. "$100.00").
 */
function formatPrice(amount: number): string {
  // Temporary: format as AUD. In production, read currency from branding.
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}
