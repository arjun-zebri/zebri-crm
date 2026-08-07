'use client'

import { CreditCard } from 'lucide-react'
import { useState } from 'react'

import { BusyLabel } from '@/components/ui/busy-label'
import { getTextColor } from '@/lib/branding/contrast'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

/**
 * Pay-with-card button for the public invoice surface.
 *
 * Uses branding to resolve button colors, corner radius, and text styles.
 * The button background comes from the action block override (if present) or
 * the MC's brand colour. The text color is derived from contrast analysis, and
 * the error message uses STATUS_COLORS.error (red is never brand-tinted).
 */
interface PayWithCardButtonProps {
  invoiceId: string
  shareToken: string
  /** The resolved branding kit for this invoice. */
  branding: PublicBranding
  /** Action block overrides for button color and radius. Required. */
  actionStyle: { color: string; radius: number }
  paymentType?: 'stage' | 'remaining'
  stageId?: string
  label?: string
}

export function PayWithCardButton({ invoiceId, shareToken, branding, actionStyle, paymentType = 'remaining', stageId, label = 'Pay with card' }: PayWithCardButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { invoiceId, shareToken, paymentType }
      if (stageId) {
        body.stageId = stageId
      }
      const res = await fetch('/api/stripe/invoice-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Failed to start payment. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const bg = actionStyle.color
  const textColor = getTextColor(bg)
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          backgroundColor: bg,
          color: textColor,
          borderRadius: actionStyle.radius,
          fontSize: `${bodyDefaults.fontSize}px`,
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
        }}
        className="flex items-center gap-2 px-4 py-2.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        <CreditCard className="w-4 h-4" strokeWidth={1.5} />
        <BusyLabel busy={loading}>{label}</BusyLabel>
      </button>
      {error && (
        <p
          className="mt-2"
          style={{
            fontSize: `${finePrintDefaults.fontSize}px`,
            color: STATUS_COLORS.error,
            fontWeight: finePrintDefaults.fontWeight,
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
