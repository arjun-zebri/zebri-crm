'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PayWithCardButton } from './pay-with-card-button'
import { CheckCircle } from 'lucide-react'
import {
  DENSITY_PAD,
  headingFontFamily,
  bodyFontFamily,
  useBrandingHead,
  type PublicBranding,
} from '@/lib/branding/public-surface'
import { PublicBlockRenderer, findActionStyle } from '@/lib/branding/public-renderer'
import { Html } from '@/lib/branding/public-blocks/html'
import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  position: number
}

interface PublicInvoice extends PublicBranding {
  id: string
  invoice_number: string
  title: string
  status: string
  subtotal: number
  tax_rate: number
  due_date: string | null
  notes: string | null
  paid_at: string | null
  couple_name: string
  bank_account_name: string | null
  bank_bsb: string | null
  bank_account_number: string | null
  items: InvoiceItem[]
  deposit_percent: number | null
  deposit_due_date: string | null
  deposit_paid_at: string | null
  final_due_date: string | null
  final_paid_at: string | null
  stripe_payment_enabled: boolean
  stripe_connect_enabled: boolean
  share_token: string
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

type PageState = 'loading' | 'not_found' | 'active' | 'overdue' | 'paid' | 'cancelled'

export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_invoice', { token: params.token })
      if (error || !data) {
        setPageState('not_found')
        return
      }

      const inv = data as PublicInvoice
      setInvoice(inv)

      if (inv.status === 'paid') { setPageState('paid'); return }
      if (inv.status === 'cancelled') { setPageState('cancelled'); return }
      if (
        inv.due_date &&
        new Date(inv.due_date + 'T00:00:00') < new Date()
      ) {
        setPageState('overdue')
        return
      }
      setPageState('active')
    }

    load()
  }, [params.token])
  useBrandingHead(invoice)

  const taxAmount = invoice ? invoice.subtotal * ((invoice.tax_rate || 0) / 100) : 0
  const total = invoice ? invoice.subtotal + taxAmount : 0
  const hasSchedule = invoice?.deposit_percent != null
  const depositAmount = hasSchedule ? total * ((invoice!.deposit_percent!) / 100) : 0
  const finalAmount = hasSchedule ? total - depositAmount : 0
  const stripeReady = invoice?.stripe_payment_enabled && invoice?.stripe_connect_enabled
  const showFullButton    = stripeReady && !hasSchedule && pageState !== 'paid' && pageState !== 'cancelled'
  const showDepositButton = stripeReady && hasSchedule && !invoice?.deposit_paid_at && pageState !== 'paid' && pageState !== 'cancelled'
  const showFinalButton   = stripeReady && hasSchedule && !!invoice?.deposit_paid_at && !invoice?.final_paid_at && pageState !== 'cancelled'

  const pageBg = invoice?.surface_color || '#fafafa'
  const textColor = invoice?.text_color || '#111827'
  const mutedColor = invoice?.muted_color || '#6B7280'
  const radius = invoice?.corner_radius ?? 16
  const headingStack = invoice ? headingFontFamily(invoice) : undefined
  const bodyStack = invoice ? bodyFontFamily(invoice) : undefined
  const headingWeight = invoice?.font_weight ?? 600
  const pad = DENSITY_PAD[invoice?.density ?? 'cozy']
  // Pull button styling out of the saved action block (if any) so the Pay
  // buttons inherit the user's customised colour + radius even though we hide
  // the action block itself for invoices (payment flow is multi-step).
  const actionStyle = findActionStyle(invoice?.branding_blocks, {
    brandColor: invoice?.brand_color || '#000000',
    cornerRadius: invoice?.corner_radius ?? 16,
  })

  // Split block tree at paymentSchedule marker
  const psIdx = invoice?.branding_blocks?.findIndex((b) => b.type === 'paymentSchedule') ?? -1
  const preInvoiceBlocks = invoice?.branding_blocks ? (psIdx >= 0 ? invoice.branding_blocks.slice(0, psIdx) : invoice.branding_blocks) : []
  const postInvoiceBlocks = invoice?.branding_blocks && psIdx >= 0 ? invoice.branding_blocks.slice(psIdx + 1) : []

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
        {/* Header banner (skipped when a block tree is present — the tree
            renders its own banner block). */}
        {invoice?.header_image_url
          && (!invoice.branding_blocks || invoice.branding_blocks.length === 0)
          && pageState !== 'loading' && pageState !== 'not_found' && pageState !== 'cancelled' && (
          <div className="mb-5 overflow-hidden" style={{ borderRadius: radius }}>
            <img src={invoice.header_image_url} alt="" className="block w-full h-40 object-cover" />
          </div>
        )}

        {/* Status banners (above the card) */}
        {invoice && pageState === 'paid' && (
          <div className="mb-3 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-medium text-emerald-700">
              This invoice has been paid. Thank you.
              {invoice.paid_at && ` · ${formatDate(invoice.paid_at.split('T')[0])}`}
            </p>
          </div>
        )}
        {invoice && pageState === 'overdue' && (
          <div className="mb-3 px-5 py-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-sm text-red-600 font-medium">
              This invoice is overdue.
              {invoice.business_name ? ` Please contact ${htmlToPlainText(invoice.business_name)} if you have any questions.` : ''}
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

        {/* Not found / cancelled */}
        {(pageState === 'not_found' || pageState === 'cancelled') && (
          <div className="bg-white shadow-sm border border-gray-100 p-10 text-center" style={{ borderRadius: radius }}>
            <p className="text-sm font-medium mb-1" style={{ color: textColor }}>Invoice unavailable</p>
            <p className="text-sm" style={{ color: mutedColor }}>
              {pageState === 'cancelled'
                ? 'This invoice is no longer active.'
                : 'This invoice is no longer available.'}
            </p>
          </div>
        )}

        {/* Invoice content — block tree path */}
        {invoice && pageState !== 'not_found' && pageState !== 'cancelled' && pageState !== 'loading'
          && invoice.branding_blocks && invoice.branding_blocks.length > 0 && (
          <div className="bg-white shadow-sm border border-gray-100 overflow-hidden" style={{ borderRadius: radius }}>
            <PublicBlockRenderer
              blocks={preInvoiceBlocks}
              branding={invoice}
              doc={{
                title: invoice.title,
                refNumber: invoice.invoice_number,
                expiresAt: invoice.due_date,
                items: invoice.items,
                subtotal: invoice.subtotal,
                taxRate: invoice.tax_rate ?? 0,
              }}
              hideAction
            />

            {/* Payment schedule */}
            {hasSchedule && (
              <div className={`${pad.cardSection} border-t border-gray-100`}>
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                  Payment schedule
                </p>
                <div className="space-y-2">
                  <div className="py-2.5 border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm" style={{ color: textColor }}>
                          Deposit ({invoice.deposit_percent}%)
                        </span>
                        {invoice.deposit_due_date && (
                          <span className="text-xs block" style={{ color: mutedColor }}>
                            Due {formatDate(invoice.deposit_due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums" style={{ color: textColor }}>
                          {formatCurrency(depositAmount)}
                        </span>
                        {invoice.deposit_paid_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>
                    {showDepositButton && (
                      <div className="mt-2">
                        <PayWithCardButton
                          invoiceId={invoice.id}
                          shareToken={invoice.share_token}
                          brandColor={actionStyle.color}
                          radius={actionStyle.radius}
                          paymentType="deposit"
                          label="Pay deposit"
                        />
                      </div>
                    )}
                  </div>
                  <div className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm" style={{ color: textColor }}>
                          Final balance ({100 - invoice.deposit_percent!}%)
                        </span>
                        {invoice.final_due_date && (
                          <span className="text-xs block" style={{ color: mutedColor }}>
                            Due {formatDate(invoice.final_due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums" style={{ color: textColor }}>
                          {formatCurrency(finalAmount)}
                        </span>
                        {invoice.final_paid_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>
                    {showFinalButton && (
                      <div className="mt-2">
                        <PayWithCardButton
                          invoiceId={invoice.id}
                          shareToken={invoice.share_token}
                          brandColor={actionStyle.color}
                          radius={actionStyle.radius}
                          paymentType="final"
                          label="Pay balance"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pay with card (full - no schedule) */}
            {showFullButton && (
              <div className={`${pad.cardSection} border-t border-gray-100`}>
                <PayWithCardButton invoiceId={invoice.id} shareToken={invoice.share_token} brandColor={actionStyle.color} radius={actionStyle.radius} />
              </div>
            )}

            {postInvoiceBlocks.length > 0 && (
              <PublicBlockRenderer
                blocks={postInvoiceBlocks}
                branding={invoice}
                doc={{
                  title: invoice.title,
                  refNumber: invoice.invoice_number,
                  expiresAt: invoice.due_date,
                  items: invoice.items,
                  subtotal: invoice.subtotal,
                  taxRate: invoice.tax_rate ?? 0,
                }}
                hideAction
              />
            )}
          </div>
        )}

        {/* Invoice content — hardcoded fallback */}
        {invoice && pageState !== 'not_found' && pageState !== 'cancelled' && pageState !== 'loading'
          && (!invoice.branding_blocks || invoice.branding_blocks.length === 0) && (
          <div className="bg-white shadow-sm border border-gray-100 overflow-hidden" style={{ borderRadius: radius }}>
            {/* Header */}
            <div className={`${pad.cardHeader} border-b border-gray-100`}>
              {invoice.logo_url ? (
                <img
                  src={invoice.logo_url}
                  alt={htmlToPlainText(invoice.business_name) || 'Logo'}
                  className="max-h-12 object-contain mb-3"
                />
              ) : invoice.business_name ? (
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                  <Html value={invoice.business_name} allowLists={false} />
                </p>
              ) : null}
              {invoice.tagline && (
                <p className="text-xs mb-3" style={{ color: mutedColor }}>
                  <Html value={invoice.tagline} allowLists={false} />
                </p>
              )}
              <h1
                className="text-2xl mb-1"
                style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
              >
                {invoice.title}
              </h1>
              <p className="text-sm" style={{ color: mutedColor }}>{invoice.couple_name}</p>
              {invoice.abn && (
                <p className="text-xs mt-1" style={{ color: mutedColor }}>ABN: {invoice.abn}</p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs" style={{ color: mutedColor }}>{invoice.invoice_number}</span>
                {invoice.due_date && !hasSchedule && (
                  <span
                    className={`text-xs font-medium ${pageState === 'overdue' ? 'text-red-500' : ''}`}
                    style={pageState === 'overdue' ? undefined : { color: mutedColor }}
                  >
                    {pageState === 'overdue' ? 'Overdue · ' : 'Due '}
                    {formatDate(invoice.due_date)}
                  </span>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className={pad.cardSection}>
              {/* Header row */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>Description</span>
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>Amount</span>
              </div>

              {(!invoice.items || invoice.items.length === 0) ? (
                <p className="text-sm py-4" style={{ color: mutedColor }}>No line items.</p>
              ) : (
                invoice.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between py-3 border-b border-gray-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: textColor }}>{item.description}</span>
                      {item.quantity !== 1 && (
                        <span className="text-xs block" style={{ color: mutedColor }}>
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: textColor }}>
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))
              )}

              {/* Subtotal + GST + Total */}
              <div className="pt-4 space-y-2">
                {(invoice.tax_rate || 0) > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: mutedColor }}>Subtotal</span>
                      <span className="text-sm tabular-nums" style={{ color: textColor }}>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: mutedColor }}>GST ({invoice.tax_rate}%)</span>
                      <span className="text-sm tabular-nums" style={{ color: textColor }}>{formatCurrency(taxAmount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: textColor }}>Total</span>
                  <span
                    className="text-lg tabular-nums"
                    style={{ color: textColor, fontFamily: headingStack, fontWeight: headingWeight }}
                  >
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment schedule */}
            {hasSchedule && (
              <div className="px-8 pb-6">
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                  Payment schedule
                </p>
                <div className="space-y-2">
                  {/* Deposit */}
                  <div className="py-2.5 border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm" style={{ color: textColor }}>
                          Deposit ({invoice.deposit_percent}%)
                        </span>
                        {invoice.deposit_due_date && (
                          <span className="text-xs block" style={{ color: mutedColor }}>
                            Due {formatDate(invoice.deposit_due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums" style={{ color: textColor }}>
                          {formatCurrency(depositAmount)}
                        </span>
                        {invoice.deposit_paid_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>
                    {showDepositButton && (
                      <div className="mt-2">
                        <PayWithCardButton
                          invoiceId={invoice.id}
                          shareToken={invoice.share_token}
                          brandColor={actionStyle.color}
                          radius={actionStyle.radius}
                          paymentType="deposit"
                          label="Pay deposit"
                        />
                      </div>
                    )}
                  </div>

                  {/* Final balance */}
                  <div className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm" style={{ color: textColor }}>
                          Final balance ({100 - invoice.deposit_percent!}%)
                        </span>
                        {invoice.final_due_date && (
                          <span className="text-xs block" style={{ color: mutedColor }}>
                            Due {formatDate(invoice.final_due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums" style={{ color: textColor }}>
                          {formatCurrency(finalAmount)}
                        </span>
                        {invoice.final_paid_at && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>
                    {showFinalButton && (
                      <div className="mt-2">
                        <PayWithCardButton
                          invoiceId={invoice.id}
                          shareToken={invoice.share_token}
                          brandColor={actionStyle.color}
                          radius={actionStyle.radius}
                          paymentType="final"
                          label="Pay balance"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment notes & bank details */}
            {(invoice.notes || invoice.bank_account_name || invoice.bank_bsb || invoice.bank_account_number) && (
              <div className="px-8 pb-8">
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                  Payment instructions
                </p>
                <div className="space-y-3">
                  {invoice.notes && (
                    <p className="text-sm whitespace-pre-wrap" style={{ color: mutedColor }}>{invoice.notes}</p>
                  )}
                  {(invoice.bank_account_name || invoice.bank_bsb || invoice.bank_account_number) && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                      {invoice.bank_account_name && (
                        <div>
                          <span style={{ color: mutedColor }}>Account name:</span>
                          <span className="ml-2" style={{ color: textColor }}>{invoice.bank_account_name}</span>
                        </div>
                      )}
                      {invoice.bank_bsb && (
                        <div>
                          <span style={{ color: mutedColor }}>BSB:</span>
                          <span className="ml-2 font-mono" style={{ color: textColor }}>{invoice.bank_bsb}</span>
                        </div>
                      )}
                      {invoice.bank_account_number && (
                        <div>
                          <span style={{ color: mutedColor }}>Account:</span>
                          <span className="ml-2 font-mono" style={{ color: textColor }}>{invoice.bank_account_number}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact footer */}
            {invoice.show_contact_on_documents && (invoice.phone || invoice.website || invoice.instagram_url || invoice.facebook_url) && (
              <div className="px-8 py-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs" style={{ color: mutedColor }}>
                {invoice.phone && <span>{invoice.phone}</span>}
                {invoice.website && (
                  <a href={invoice.website} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    {invoice.website}
                  </a>
                )}
                {invoice.instagram_url && (
                  <a href={invoice.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    Instagram
                  </a>
                )}
                {invoice.facebook_url && (
                  <a href={invoice.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                    Facebook
                  </a>
                )}
              </div>
            )}

            {/* Pay with card (full - no schedule) */}
            {showFullButton && (
              <div className="px-8 pb-8">
                <PayWithCardButton invoiceId={invoice.id} shareToken={invoice.share_token} brandColor={actionStyle.color} radius={actionStyle.radius} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
