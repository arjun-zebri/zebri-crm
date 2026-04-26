'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import {
  X, Loader2, Copy, Check, Mail, Download, RefreshCw, Trash2, FileSignature,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { generateAndPrintPdf } from '@/lib/generate-pdf'
import { buildContractVariables, renderContractHtml } from '@/lib/contract-variables'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  signed: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
  revoked: 'Revoked',
}

interface Contract {
  id: string
  title: string
  contract_number: string
  status: string
  content: JSONContent
  expires_at: string | null
  share_token: string
  share_token_enabled: boolean
  quote_id: string | null
  couple_id: string
  signed_at: string | null
  signer_name: string | null
  signer_ip: string | null
  signer_user_agent: string | null
  declined_at: string | null
  declined_reason: string | null
  mc_signature_name: string | null
  locked_content_html: string | null
  email_sent_at: string | null
}

interface QuoteOption {
  id: string
  quote_number: string
  title: string
  status: string
  subtotal: number
}

interface ContractTemplate {
  id: string
  name: string
  description: string | null
  content: JSONContent
}

interface ContractBuilderModalProps {
  contractId: string
  coupleId: string
  coupleName: string
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_TEMPLATE: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Wedding MC Service Agreement' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This agreement is between ' },
        { type: 'mention', attrs: { id: 'mc_business_name', label: 'Your business name' } },
        { type: 'text', text: ' ("the MC") and ' },
        { type: 'mention', attrs: { id: 'couple_name', label: 'Couple name' } },
        { type: 'text', text: ' ("the Couple") for wedding MC services on ' },
        { type: 'mention', attrs: { id: 'event_date', label: 'Event date' } },
        { type: 'text', text: ' at ' },
        { type: 'mention', attrs: { id: 'venue', label: 'Venue' } },
        { type: 'text', text: '.' },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Services' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'The MC will provide wedding MC services including reception hosting, timeline coordination, announcements, and crowd engagement.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Fee and payment' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Total fee: ' },
        { type: 'mention', attrs: { id: 'total_amount', label: 'Total amount' } },
        { type: 'text', text: '. A non-refundable deposit of ' },
        { type: 'mention', attrs: { id: 'deposit_amount', label: 'Deposit amount' } },
        { type: 'text', text: ' is payable to secure the booking. The balance is due 14 days before the event.' },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Cancellation and rescheduling' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Deposits are non-refundable. Cancellations within 30 days of the event forfeit the balance. Rescheduling is subject to MC availability.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Force majeure' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Neither party is liable for failure to perform due to events beyond reasonable control. In such cases, the parties will work in good faith to reschedule.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5. Acceptance' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'By signing below, the Couple agrees to the terms above.' }] },
  ],
}

export function ContractBuilderModal({
  contractId,
  coupleId,
  coupleName,
  isOpen,
  onClose,
}: ContractBuilderModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<JSONContent>(DEFAULT_TEMPLATE)
  const [expiresAt, setExpiresAt] = useState('')
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    enabled: isOpen && !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single()
      if (error) throw error
      return data as Contract
    },
  })

  const { data: quotes } = useQuery({
    queryKey: ['couple-accepted-quotes', coupleId],
    enabled: isOpen && !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, subtotal')
        .eq('couple_id', coupleId)
        .in('status', ['accepted', 'sent'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as QuoteOption[]) || []
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['contract-templates'],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name, description, content')
        .order('position', { ascending: true })
      if (error) throw error
      return (data as ContractTemplate[]) || []
    },
  })

  useEffect(() => {
    if (!contract) return
    setTitle(contract.title)
    setContent(contract.content && Object.keys(contract.content).length > 0 ? contract.content : DEFAULT_TEMPLATE)
    setExpiresAt(contract.expires_at ?? '')
    setQuoteId(contract.quote_id)
    setDirty(false)
  }, [contract?.id])

  const isLocked =
    contract?.status === 'sent' ||
    contract?.status === 'signed' ||
    contract?.status === 'declined' ||
    contract?.status === 'expired'

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('contracts')
        .update({
          title: title || `Contract for ${coupleName}`,
          content,
          expires_at: expiresAt || null,
          quote_id: quoteId,
        })
        .eq('id', contractId)
      if (error) throw error
    },
    onSuccess: () => {
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] })
    },
    onError: () => toast('Failed to save contract', 'error'),
  })

  const send = async () => {
    if (!contract) return
    if (dirty) await save.mutateAsync()
    setSending(true)
    try {
      const res = await fetch('/api/email/send-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to send contract', 'error')
      } else {
        toast('Contract sent')
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
        queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
        queryClient.invalidateQueries({ queryKey: ['all-contracts'] })
      }
    } finally {
      setSending(false)
    }
  }

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_contract', { p_contract_id: contractId })
      if (error) throw error
    },
    onSuccess: () => {
      toast('Contract revoked — you can now edit')
      setConfirmingRevoke(false)
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] })
    },
    onError: () => toast('Failed to revoke contract', 'error'),
  })

  const deleteContract = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('contracts').delete().eq('id', contractId)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Contract deleted')
      setConfirmingDelete(false)
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] })
      onClose()
    },
    onError: () => toast('Failed to delete contract', 'error'),
  })

  const copyShareLink = () => {
    if (!contract) return
    const url = `${window.location.origin}/contract/${contract.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const downloadPdf = async () => {
    if (!contract) return
    // Fetch MC metadata + couple + quote for fresh variable substitution (signed render path)
    const { data: userRes } = await supabase.auth.getUser()
    const { data: firstEvent } = await supabase
      .from('events')
      .select('date, venue')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { data: quote } = contract.quote_id
      ? await supabase
          .from('quotes')
          .select('subtotal, tax_rate, discount_type, discount_value')
          .eq('id', contract.quote_id)
          .maybeSingle()
      : { data: null }

    const depositPercent = Number(
      (userRes.user?.user_metadata?.default_deposit_percent as number | undefined) ?? 25
    )
    const vars = buildContractVariables({
      couple: { name: coupleName, email: null },
      firstEvent: firstEvent ?? null,
      quote: quote ?? null,
      userMeta: userRes.user?.user_metadata ?? {},
      depositPercent,
    })

    const html = contract.locked_content_html ?? renderContractHtml(content, vars)
    generateAndPrintPdf({
      type: 'contract',
      documentNumber: contract.contract_number,
      title: contract.title,
      status: contract.status,
      coupleName,
      businessName: (userRes.user?.user_metadata?.business_name as string | undefined) ?? '',
      items: [],
      subtotal: 0,
      total: 0,
      contractHtml: html,
      signerName: contract.signer_name,
      signedAt: contract.signed_at,
      signerIp: contract.signer_ip,
      signerUserAgent: contract.signer_user_agent,
      mcSignatureName: contract.mc_signature_name,
    })
  }

  if (!isOpen) return null

  const shareUrl = contract ? `${typeof window !== 'undefined' ? window.location.origin : ''}/contract/${contract.share_token}` : ''

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl overflow-hidden flex flex-col max-h-screen sm:max-h-[92vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileSignature size={18} strokeWidth={1.5} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">
                  {contract?.contract_number || 'Contract'}
                </h2>
                <p className="text-xs text-gray-500 truncate">{coupleName}</p>
              </div>
              {contract && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[contract.status]}`}>
                  {STATUS_LABELS[contract.status]}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                    disabled={isLocked}
                    placeholder={`Contract for ${coupleName}`}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-gray-400 disabled:bg-gray-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Expires on (optional)</label>
                    <DatePicker
                      value={expiresAt}
                      onChange={(v) => { setExpiresAt(v); setDirty(true) }}
                      disabled={isLocked}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Linked quote (optional)</label>
                    <select
                      value={quoteId ?? ''}
                      onChange={(e) => { setQuoteId(e.target.value || null); setDirty(true) }}
                      disabled={isLocked}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-gray-400 disabled:bg-gray-50 cursor-pointer"
                    >
                      <option value="">None</option>
                      {(quotes || []).map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quote_number} — {q.title || 'Untitled'} ({q.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isLocked && (templates?.length ?? 0) > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Start from a template</label>
                    <select
                      onChange={(e) => {
                        const t = (templates || []).find((t) => t.id === e.target.value)
                        if (t) {
                          setContent(t.content && Object.keys(t.content).length > 0 ? t.content : DEFAULT_TEMPLATE)
                          setDirty(true)
                        }
                        e.target.value = ''
                      }}
                      defaultValue=""
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white cursor-pointer focus:outline-none focus:border-gray-400"
                    >
                      <option value="" disabled>Apply a template…</option>
                      {(templates || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Contract body</label>
                  {isLocked && contract?.locked_content_html ? (
                    <div
                      className="border border-gray-200 rounded-xl p-4 prose prose-sm max-w-none bg-gray-50"
                      dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}
                    />
                  ) : (
                    <RichTextEditor
                      value={content}
                      onChange={(v) => { setContent(v); setDirty(true) }}
                      editable={!isLocked}
                    />
                  )}
                  {!isLocked && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Variables like <span className="font-mono">{'{{couple_name}}'}</span> are replaced with real data when you send the contract.
                    </p>
                  )}
                </div>

                {contract?.status === 'signed' && (
                  <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 text-sm text-emerald-900">
                    Signed by <strong>{contract.signer_name}</strong> on{' '}
                    {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    {contract.signer_ip ? <span className="block text-xs text-emerald-700/80 mt-1">From IP {contract.signer_ip}</span> : null}
                  </div>
                )}

                {contract?.status === 'declined' && (
                  <div className="border border-red-100 bg-red-50 rounded-xl p-4 text-sm text-red-900">
                    Declined{contract.declined_reason ? ` — ${contract.declined_reason}` : ''}.
                  </div>
                )}

                {contract && contract.status !== 'draft' && contract.share_token_enabled && (
                  <div className="border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Share link</p>
                      <p className="text-xs text-gray-900 truncate font-mono">{shareUrl}</p>
                    </div>
                    <button
                      onClick={copyShareLink}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 rounded-lg px-2.5 py-1.5 transition cursor-pointer shrink-0"
                    >
                      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.5} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap flex-shrink-0 bg-white">
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs font-medium text-gray-400 hover:text-red-500 transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Trash2 size={13} strokeWidth={1.5} />
              Delete
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {contract?.status === 'signed' && (
                <button
                  onClick={downloadPdf}
                  className="text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} strokeWidth={1.5} /> Download PDF
                </button>
              )}

              {contract?.status === 'sent' && (
                <button
                  onClick={() => setConfirmingRevoke(true)}
                  className="text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} strokeWidth={1.5} /> Revoke &amp; Edit
                </button>
              )}

              {!isLocked && (
                <>
                  <button
                    onClick={() => save.mutate()}
                    disabled={!dirty || save.isPending}
                    className="text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {save.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                    Save draft
                  </button>
                  <button
                    onClick={send}
                    disabled={sending}
                    className="text-xs font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-3.5 py-2 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} strokeWidth={1.5} />}
                    {sending ? 'Sending…' : 'Send to couple'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRevoke}
        title="Revoke and edit this contract?"
        description="The current link will stop working and the contract will go back to draft so you can edit it. The couple will need to be re-sent the new link."
        confirmLabel="Revoke & edit"
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirmingRevoke(false)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this contract?"
        description="This removes the contract permanently."
        confirmLabel="Delete"
        loading={deleteContract.isPending}
        onConfirm={() => deleteContract.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  )
}
