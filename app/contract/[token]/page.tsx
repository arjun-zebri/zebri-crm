'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Check, X, Download, AlertCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateAndPrintPdf } from '@/lib/generate-pdf'

interface PublicContract {
  id: string
  title: string
  contract_number: string
  status: string
  locked_content_html: string | null
  expires_at: string | null
  signed_at: string | null
  signer_name: string | null
  signer_ip: string | null
  signer_user_agent: string | null
  declined_at: string | null
  declined_reason: string | null
  mc_signature_name: string | null
  email_sent_at: string | null
  couple_name: string
  business_name: string | null
  logo_url: string | null
  brand_color: string
  tagline: string | null
  show_contact_on_documents: boolean
  phone: string | null
  website: string | null
  instagram_url: string | null
  facebook_url: string | null
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  try {
    return new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return s
  }
}

function formatDateTime(s: string | null): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return s
  }
}

function getBrandTextColor(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#111827' : '#ffffff'
}

type PageState = 'loading' | 'not_found' | 'active' | 'expired' | 'signed' | 'declined'

export default function PublicContractPage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()

  const [contract, setContract] = useState<PublicContract | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const load = async () => {
    const { data, error } = await supabase.rpc('get_public_contract', { token: params.token })
    if (error || !data) {
      setPageState('not_found')
      return
    }
    const c = data as PublicContract
    setContract(c)

    if (c.status === 'signed') { setPageState('signed'); return }
    if (c.status === 'declined') { setPageState('declined'); return }
    if (c.expires_at && new Date(c.expires_at + 'T00:00:00') < new Date()) {
      setPageState('expired'); return
    }
    setPageState('active')
  }

  useEffect(() => { load() }, [params.token])

  const handleSign = async () => {
    if (!signerName.trim() || !agreed) return
    setActionLoading(true)
    setActionError('')
    const res = await fetch('/api/contract/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, signer_name: signerName }),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) {
      if (data.error === 'expired') setPageState('expired')
      else if (data.error === 'already_actioned') await load()
      else setActionError(data.error || 'Something went wrong. Please try again.')
      return
    }
    await load()
  }

  const handleDecline = async () => {
    setActionLoading(true)
    setActionError('')
    const res = await fetch('/api/contract/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, reason: declineReason }),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) {
      setActionError(data.error || 'Something went wrong. Please try again.')
      return
    }
    setDeclineOpen(false)
    await load()
  }

  const downloadPdf = () => {
    if (!contract) return
    generateAndPrintPdf({
      type: 'contract',
      documentNumber: contract.contract_number,
      title: contract.title,
      status: contract.status,
      coupleName: contract.couple_name,
      businessName: contract.business_name ?? '',
      items: [],
      subtotal: 0,
      total: 0,
      contractHtml: contract.locked_content_html ?? '',
      signerName: contract.signer_name,
      signedAt: contract.signed_at,
      signerIp: contract.signer_ip,
      signerUserAgent: contract.signer_user_agent,
      mcSignatureName: contract.mc_signature_name,
    })
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <AlertCircle size={32} strokeWidth={1.5} className="text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Contract not found</h1>
          <p className="text-sm text-gray-500">This link may be invalid or has been revoked. Please contact your MC.</p>
        </div>
      </div>
    )
  }

  if (!contract) return null

  const brand = contract.brand_color || '#A7F3D0'
  const brandText = getBrandTextColor(brand)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Branded header */}
          <div className="p-6 sm:p-8" style={{ backgroundColor: brand, color: brandText }}>
            <div className="flex items-center gap-3 mb-4">
              {contract.logo_url && (
                <img src={contract.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-white" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: brandText }}>
                  {contract.business_name || 'Your MC'}
                </p>
                {contract.tagline && (
                  <p className="text-xs opacity-80 truncate" style={{ color: brandText }}>{contract.tagline}</p>
                )}
              </div>
            </div>
            <p className="text-xs font-medium opacity-75 uppercase tracking-wide mb-1" style={{ color: brandText }}>
              Contract {contract.contract_number}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: brandText }}>
              {contract.title}
            </h1>
            {contract.expires_at && pageState === 'active' && (
              <p className="mt-3 text-sm opacity-90" style={{ color: brandText }}>
                Please sign by <strong>{formatDate(contract.expires_at)}</strong>
              </p>
            )}
          </div>

          {/* Body */}
          <div className="p-6 sm:p-10 space-y-8">
            {pageState === 'expired' && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-900">
                This contract has expired. Please contact {contract.business_name || 'your MC'} for a new link.
              </div>
            )}

            {pageState === 'declined' && (
              <div className="border border-red-100 bg-red-50 rounded-xl p-4 text-sm text-red-900">
                This contract was declined on {formatDateTime(contract.declined_at)}.
                {contract.declined_reason && <span className="block mt-1">Reason: {contract.declined_reason}</span>}
              </div>
            )}

            {pageState === 'signed' && (
              <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck size={20} strokeWidth={1.5} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-900 flex-1">
                  Signed by <strong>{contract.signer_name}</strong> on {formatDateTime(contract.signed_at)}.
                  {contract.signer_ip && <span className="block text-xs text-emerald-800/80 mt-1">IP {contract.signer_ip}</span>}
                </div>
                <button
                  onClick={downloadPdf}
                  className="shrink-0 text-xs font-medium text-emerald-900 border border-emerald-200 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} strokeWidth={1.5} /> PDF
                </button>
              </div>
            )}

            {/* Contract body */}
            {contract.locked_content_html ? (
              <div
                className="contract-content text-sm"
                dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}
              />
            ) : (
              <p className="text-sm text-gray-500">No content.</p>
            )}

            {/* MC countersignature */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-xs font-medium text-gray-500 mb-1">Signed by MC</p>
              <p className="text-xl text-gray-900" style={{ fontFamily: 'Caveat, "Brush Script MT", cursive' }}>
                {contract.mc_signature_name || contract.business_name || 'Your MC'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {contract.business_name || ''} · {formatDate(contract.email_sent_at)}
              </p>
            </div>

            {/* Couple signature (active only) */}
            {pageState === 'active' && (
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <p className="text-xs font-medium text-gray-500">Sign to accept</p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Your full legal name</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder={contract.couple_name}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-gray-400"
                  />
                </div>
                {signerName.trim() && (
                  <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Your signature will appear as</p>
                    <p className="text-2xl text-gray-900" style={{ fontFamily: 'Caveat, "Brush Script MT", cursive' }}>
                      {signerName}
                    </p>
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-black w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the terms above and intend my typed name to serve as my legal signature.
                  </span>
                </label>
                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={handleSign}
                    disabled={!signerName.trim() || !agreed || actionLoading}
                    className="text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2} />}
                    {actionLoading ? 'Signing…' : 'Sign contract'}
                  </button>
                  <button
                    onClick={() => setDeclineOpen(true)}
                    className="text-sm font-medium text-gray-600 hover:text-red-600 border border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {contract.show_contact_on_documents && (contract.phone || contract.website) && (
              <div className="border-t border-gray-100 pt-6 text-xs text-gray-500 space-y-0.5">
                {contract.phone && <p>{contract.phone}</p>}
                {contract.website && <p>{contract.website}</p>}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Secured by Zebri · <a href="https://zebri.com.au" className="hover:text-gray-600">zebri.com.au</a>
        </p>
      </div>

      {/* Decline dialog */}
      {declineOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[70]" onClick={() => setDeclineOpen(false)} />
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
              <div className="px-6 py-6">
                <h3 className="text-base font-semibold text-gray-900 mb-2">Decline this contract?</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Let {contract.business_name || 'your MC'} know why, or leave blank.
                </p>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder="Reason (optional)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-gray-400 mb-4"
                />
                {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeclineOpen(false)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <X size={13} strokeWidth={2} />}
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
