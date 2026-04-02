'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'

interface PayWithCardButtonProps {
  invoiceId: string
  shareToken: string
}

export function PayWithCardButton({ invoiceId, shareToken }: PayWithCardButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/invoice-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, shareToken }),
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

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        <CreditCard className="w-4 h-4" />
        {loading ? 'Redirecting...' : 'Pay with card'}
      </button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
