'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

interface BrandingPreviewProps {
  logoUrl: string
  brandColor: string
  tagline: string
  businessName: string
  abn: string
  showContactOnDocuments: boolean
  phone: string
  website: string
  instagramUrl: string
  facebookUrl: string
}

function getTextColor(hex: string): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return '#ffffff'
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

export function BrandingPreview({
  logoUrl, brandColor, tagline, businessName, abn,
  showContactOnDocuments, phone, website, instagramUrl, facebookUrl,
}: BrandingPreviewProps) {
  const [open, setOpen] = useState<'quote' | 'invoice' | null>(null)
  const textColor = getTextColor(brandColor)

  const Header = ({ title, subtitle, meta }: { title: string; subtitle: string; meta: React.ReactNode }) => (
    <div className="pb-5 mb-2 border-b border-gray-100">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="max-h-10 object-contain mb-3" />
      ) : businessName ? (
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{businessName}</p>
      ) : null}
      {tagline && <p className="text-xs text-gray-400 mb-3">{tagline}</p>}
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">{title}</h1>
      <p className="text-sm text-gray-500">{subtitle}</p>
      {abn && <p className="text-xs text-gray-400 mt-1">ABN: {abn}</p>}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">{meta}</div>
    </div>
  )

  const ContactFooter = () => {
    if (!showContactOnDocuments || (!phone && !website && !instagramUrl && !facebookUrl)) return null
    return (
      <div className="pt-4 mt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
        {phone && <span>{phone}</span>}
        {website && <a className="hover:text-gray-600">{website}</a>}
        {instagramUrl && <span>Instagram</span>}
        {facebookUrl && <span>Facebook</span>}
      </div>
    )
  }

  return (
    <div className="sticky top-6 space-y-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Preview</p>

      <div className="flex gap-3">
        {(['quote', 'invoice'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOpen(type)}
            className="flex-1 flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition cursor-pointer group"
          >
            {/* Mini doc thumbnail */}
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1.5">
              <div className="h-1.5 bg-gray-300 rounded w-2/3" />
              <div className="h-1.5 bg-gray-200 rounded w-1/2" />
              <div className="h-1.5 bg-gray-200 rounded w-3/4" />
              <div
                className="h-4 rounded mt-2 w-full"
                style={{ backgroundColor: brandColor, opacity: 0.9 }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 capitalize group-hover:text-gray-900 transition">
              {type} preview
            </span>
          </button>
        ))}
      </div>

      {/* Quote Preview Modal */}
      <Modal isOpen={open === 'quote'} onClose={() => setOpen(null)} title="Quote Preview">
        <Header
          title="Wedding MC Services"
          subtitle="Alex & Jordan 2026"
          meta={<><span>QU-001</span><span>Expires 30 April 2026</span></>}
        />
        <div className="space-y-0">
          <div className="flex justify-between pb-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</span>
          </div>
          {[
            ['Full Day MC Services', 2500],
            ['Pre-Wedding Consultation', 200],
          ].map(([desc, amt]) => (
            <div key={desc as string} className="flex justify-between py-3 border-b border-gray-50">
              <span className="text-sm text-gray-800">{desc}</span>
              <span className="text-sm font-medium tabular-nums ml-4">{fmt(amt as number)}</span>
            </div>
          ))}
          <div className="pt-4 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-sm text-gray-700 tabular-nums">{fmt(2700)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">GST (10%)</span>
              <span className="text-sm text-gray-700 tabular-nums">{fmt(270)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-semibold text-gray-900 tabular-nums">{fmt(2970)}</span>
            </div>
          </div>
        </div>
        <ContactFooter />
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 py-3 text-sm font-medium rounded-xl transition"
            style={{ backgroundColor: brandColor, color: textColor }}
          >
            Accept Quote
          </button>
          <button
            type="button"
            className="flex-1 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl"
          >
            Decline
          </button>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal isOpen={open === 'invoice'} onClose={() => setOpen(null)} title="Invoice Preview">
        <Header
          title="Wedding MC Invoice"
          subtitle="Alex & Jordan 2026"
          meta={<><span>INV-001</span><span className="text-red-400">Due 19 April 2026</span></>}
        />
        <div className="space-y-0">
          <div className="flex justify-between pb-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</span>
          </div>
          {[
            ['Full Day MC Services', 2500],
            ['Travel & Accommodation', 250],
          ].map(([desc, amt]) => (
            <div key={desc as string} className="flex justify-between py-3 border-b border-gray-50">
              <span className="text-sm text-gray-800">{desc}</span>
              <span className="text-sm font-medium tabular-nums ml-4">{fmt(amt as number)}</span>
            </div>
          ))}
          <div className="pt-4 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-sm text-gray-700 tabular-nums">{fmt(2750)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">GST (10%)</span>
              <span className="text-sm text-gray-700 tabular-nums">{fmt(275)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-semibold text-gray-900 tabular-nums">{fmt(3025)}</span>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Payment instructions</p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
            <div><span className="text-gray-500">Account name:</span><span className="text-gray-900 ml-2">{businessName || 'Your Business Name'}</span></div>
            <div><span className="text-gray-500">BSB:</span><span className="text-gray-900 ml-2 font-mono">062-000</span></div>
            <div><span className="text-gray-500">Account:</span><span className="text-gray-900 ml-2 font-mono">12345678</span></div>
          </div>
        </div>
        <ContactFooter />
        <div className="mt-6">
          <button
            type="button"
            className="w-full py-3 text-sm font-medium rounded-xl transition"
            style={{ backgroundColor: brandColor, color: textColor }}
          >
            Pay with card
          </button>
        </div>
      </Modal>
    </div>
  )
}
