'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  // Perceived luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55
}

interface PayWithCardButtonProps {
  invoiceId: string
  shareToken: string
  brandColor?: string
  paymentType?: 'full' | 'deposit' | 'final'
  label?: string
}

export function PayWithCardButton({ invoiceId, shareToken, brandColor, paymentType = 'full', label = 'Pay with card' }: PayWithCardButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/invoice-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, shareToken, paymentType }),
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

  const bg = brandColor || '#000000'
  const textColor = isLightColor(bg) ? '#111111' : '#ffffff'

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{ backgroundColor: bg, color: textColor }}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <CreditCard className="w-4 h-4" />
        {loading ? 'Redirecting...' : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
