'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTextColor } from '@/lib/branding/contrast'
import {
  DENSITY_PAD,
  headingFontFamily,
  bodyFontFamily,
  useBrandingHead,
  type PublicBranding,
} from '@/lib/branding/public-surface'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import { Html } from '@/lib/branding/public-blocks/html'
import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

interface QuoteItem {
  id: string
  description: string
  amount: number
  position: number
}

interface PublicQuote extends PublicBranding {
  id: string
  title: string
  quote_number: string
  status: string
  subtotal: number
  tax_rate: number | null
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  notes: string | null
  expires_at: string | null
  accepted_at: string | null
  couple_name: string
  items: QuoteItem[]
  branding_blocks: Block[] | null
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type PageState = 'loading' | 'not_found' | 'active' | 'expired' | 'accepted' | 'declined'

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()

  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmingAccept, setConfirmingAccept] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.rpc('get_public_quote', { token: params.token })
    if (error || !data) {
      setPageState('not_found')
      return
    }

    const q = data as PublicQuote
    setQuote(q)

    if (q.status === 'accepted') { setPageState('accepted'); return }
    if (q.status === 'declined') { setPageState('declined'); return }
    if (q.expires_at && new Date(q.expires_at + 'T00:00:00') < new Date()) {
      setPageState('expired')
      return
    }
    setPageState('active')
  }

  useEffect(() => { load() }, [params.token])
  useBrandingHead(quote)

  const handleAccept = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('accept_quote', { token: params.token })
    setActionLoading(false)
    if (data?.error) {
      if (data.error === 'expired') setPageState('expired')
      else if (data.error === 'already_actioned') await load()
      else setActionError('Something went wrong. Please try again.')
      return
    }
    await load()
  }

  const handleDecline = async () => {
    setActionLoading(true)
    setActionError('')
    const { data } = await supabase.rpc('decline_quote', { token: params.token })
    setActionLoading(false)
    if (data?.error) {
      if (data.error === 'already_actioned') await load()
      else setActionError('Something went wrong. Please try again.')
      return
    }
    await load()
  }

  const pageBg = quote?.surface_color || '#fafafa'
  const textColor = quote?.text_color || '#111827'
  const mutedColor = quote?.muted_color || '#6B7280'
  const brand = quote?.brand_color || '#111827'
  const radius = quote?.corner_radius ?? 16
  const headingStack = quote ? headingFontFamily(quote) : undefined
  const bodyStack = quote ? bodyFontFamily(quote) : undefined
  const headingWeight = quote?.font_weight ?? 600
  const pad = DENSITY_PAD[quote?.density ?? 'cozy']

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
        {/* Header banner (only when there's no custom block tree — the tree
            renders its own banner block at its chosen height). */}
        {quote?.header_image_url
          && (!quote.branding_blocks || quote.branding_blocks.length === 0)
          && pageState !== 'loading' && pageState !== 'not_found' && (
          <div className="mb-5 overflow-hidden" style={{ borderRadius: radius }}>
            <img src={quote.header_image_url} alt="" className="block w-full h-40 object-cover" />
          </div>
        )}

        {/* Status banners (rendered above the card for accepted/declined/expired states) */}
        {quote && pageState === 'accepted' && (
          <div className="mb-3 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-semibold text-emerald-700 mb-1">
              Quote accepted{quote.accepted_at ? ` on ${formatDate(quote.accepted_at.split('T')[0])}` : ''}.
            </p>
            <p className="text-sm text-emerald-600">
              {quote.business_name ? `${htmlToPlainText(quote.business_name)} will` : 'Your MC will'} be in touch to confirm the details.
            </p>
          </div>
        )}
        {quote && pageState === 'declined' && (
          <div className="mb-3 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-sm" style={{ color: mutedColor }}>You declined this quote.</p>
          </div>
        )}
        {quote && pageState === 'expired' && (
          <div className="mb-3 px-5 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-700">
              This quote expired on {formatDate(quote.expires_at!)}.
              {quote.business_name ? ` Please contact ${htmlToPlainText(quote.business_name)} for an updated quote.` : ''}
            </p>
          </div>
        )}

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="bg-white shadow-sm border border-gray-100 p-8 space-y-4" style={{ borderRadius: radius }}>
            <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
            <div className="space-y-2 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Not found / disabled */}
        {pageState === 'not_found' && (
          <div className="bg-white shadow-sm border border-gray-100 p-10 text-center" style={{ borderRadius: radius }}>
            <p className="text-sm font-medium mb-1" style={{ color: textColor }}>Quote unavailable</p>
            <p className="text-sm" style={{ color: mutedColor }}>This quote is no longer available.</p>
          </div>
        )}

        {/* Quote content — block tree path */}
        {quote && pageState !== 'not_found' && pageState !== 'loading'
          && quote.branding_blocks && quote.branding_blocks.length > 0 && (
          <div className="bg-white shadow-sm border border-gray-100 overflow-hidden" style={{ borderRadius: radius }}>
            <PublicBlockRenderer
              blocks={quote.branding_blocks}
              branding={quote}
              doc={{
                title: quote.title,
                refNumber: quote.quote_number,
                expiresAt: quote.expires_at,
                items: quote.items,
                subtotal: quote.subtotal,
                taxRate: quote.tax_rate ?? 0,
                discountType: quote.discount_type,
                discountValue: quote.discount_value,
              }}
              onPrimary={handleAccept}
              onSecondary={handleDecline}
              primaryDisabled={actionLoading}
              primaryLoading={actionLoading}
              hideAction={pageState !== 'active'}
            />
            {quote.notes && (
              <div className={`${pad.cardSection} border-t border-gray-100`}>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: mutedColor }}>Notes</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: mutedColor }}>{quote.notes}</p>
              </div>
            )}
            {actionError && (
              <div className={`${pad.cardSection} bg-red-50 border-t border-red-100`}>
                <p className="text-sm text-red-600">{actionError}</p>
              </div>
            )}
          </div>
        )}

        {/* Quote content — hardcoded fallback (no saved block tree) */}
        {quote && pageState !== 'not_found' && pageState !== 'loading'
          && (!quote.branding_blocks || quote.branding_blocks.length === 0) && (
          <div className="bg-white shadow-sm border border-gray-100 overflow-hidden" style={{ borderRadius: radius }}>
            {/* Header */}
            <div className={`${pad.cardHeader} border-b border-gray-100`}>
              {quote.logo_url ? (
                <img
                  src={quote.logo_url}
                  alt={htmlToPlainText(quote.business_name) || 'Logo'}
                  className="max-h-12 object-contain mb-3"
                />
              ) : quote.business_name ? (
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                  <Html value={quote.business_name} allowLists={false} />
                </p>
              ) : null}
              {quote.tagline && (
                <p className="text-xs mb-3" style={{ color: mutedColor }}>
                  <Html value={quote.tagline} allowLists={false} />
                </p>
              )}
              <h1
                className="text-2xl mb-1"
                style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
              >
                {quote.title}
              </h1>
              <p className="text-sm" style={{ color: mutedColor }}>{quote.couple_name}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs" style={{ color: mutedColor }}>{quote.quote_number}</span>
                {quote.expires_at && pageState !== 'expired' && (
                  <span className="text-xs" style={{ color: mutedColor }}>
                    Expires {formatDate(quote.expires_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className={pad.cardSection}>
              <div className="space-y-0">
                {/* Header row */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>Description</span>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>Amount</span>
                </div>

                {(!quote.items || quote.items.length === 0) ? (
                  <p className="text-sm py-4" style={{ color: mutedColor }}>No line items.</p>
                ) : (
                  quote.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50">
                      <span className="text-sm" style={{ color: textColor }}>{item.description}</span>
                      <span className="text-sm font-medium tabular-nums ml-4" style={{ color: textColor }}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}

                {/* Totals */}
                <div className="pt-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: mutedColor }}>Subtotal</span>
                    <span className="text-sm tabular-nums" style={{ color: textColor }}>{formatCurrency(quote.subtotal)}</span>
                  </div>
                  {quote.discount_type && (quote.discount_value ?? 0) > 0 && (() => {
                    const discountAmt = quote.discount_type === 'percentage'
                      ? quote.subtotal * (quote.discount_value ?? 0) / 100
                      : (quote.discount_value ?? 0)
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: mutedColor }}>
                          Discount{quote.discount_type === 'percentage' ? ` (${quote.discount_value}%)` : ''}
                        </span>
                        <span className="text-sm text-red-500 tabular-nums">-{formatCurrency(discountAmt)}</span>
                      </div>
                    )
                  })()}
                  {(quote.tax_rate ?? 0) > 0 && (() => {
                    const discountAmt = quote.discount_type && (quote.discount_value ?? 0) > 0
                      ? (quote.discount_type === 'percentage' ? quote.subtotal * (quote.discount_value ?? 0) / 100 : (quote.discount_value ?? 0))
                      : 0
                    const taxableAmount = quote.subtotal - discountAmt
                    const taxAmt = taxableAmount * ((quote.tax_rate ?? 0) / 100)
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: mutedColor }}>GST ({quote.tax_rate}%)</span>
                        <span className="text-sm tabular-nums" style={{ color: textColor }}>{formatCurrency(taxAmt)}</span>
                      </div>
                    )
                  })()}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-semibold" style={{ color: textColor }}>Total</span>
                    <span
                      className="text-lg tabular-nums"
                      style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
                    >
                      {(() => {
                        const discountAmt = quote.discount_type && (quote.discount_value ?? 0) > 0
                          ? (quote.discount_type === 'percentage' ? quote.subtotal * (quote.discount_value ?? 0) / 100 : (quote.discount_value ?? 0))
                          : 0
                        const taxableAmount = quote.subtotal - discountAmt
                        const tax = taxableAmount * ((quote.tax_rate ?? 0) / 100)
                        return formatCurrency(taxableAmount + tax)
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="px-8 pb-6">
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: mutedColor }}>Notes</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: mutedColor }}>{quote.notes}</p>
              </div>
            )}

            {/* Contact footer */}
            {quote.show_contact_on_documents && (quote.phone || quote.website || quote.instagram_url || quote.facebook_url) && (
              <div className="px-8 py-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs" style={{ color: mutedColor }}>
                {quote.phone && <span>{quote.phone}</span>}
                {quote.website && (
                  <a href={quote.website} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    {quote.website}
                  </a>
                )}
                {quote.instagram_url && (
                  <a href={quote.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    Instagram
                  </a>
                )}
                {quote.facebook_url && (
                  <a href={quote.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    Facebook
                  </a>
                )}
              </div>
            )}

            {/* Action buttons - only on active state */}
            {pageState === 'active' && (
              <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                {actionError && (
                  <p className="text-sm text-red-500 mb-4">{actionError}</p>
                )}
                {confirmingAccept ? (
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: textColor }}>Accept this quote?</p>
                    <p className="text-xs mb-4" style={{ color: mutedColor }}>
                      By accepting you confirm you have reviewed the details above.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        style={{
                          backgroundColor: brand,
                          color: getTextColor(brand),
                          borderRadius: radius,
                        }}
                        className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading ? 'Processing...' : 'Yes, accept'}
                      </button>
                      <button
                        onClick={() => setConfirmingAccept(false)}
                        disabled={actionLoading}
                        style={{ borderRadius: radius, color: textColor }}
                        className="flex-1 py-3 border border-gray-200 text-sm font-medium hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingAccept(true)}
                      disabled={actionLoading}
                      style={{
                        backgroundColor: brand,
                        color: getTextColor(brand),
                        borderRadius: radius,
                      }}
                      className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                    >
                      Accept Quote
                    </button>
                    <button
                      onClick={handleDecline}
                      disabled={actionLoading}
                      style={{ borderRadius: radius, color: textColor }}
                      className="flex-1 py-3 border border-gray-200 text-sm font-medium hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
