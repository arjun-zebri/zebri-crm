'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { DatePicker } from '@/components/ui/date-picker'
import { ArrowLeft, Copy, Check, RefreshCw, Trash2, Plus } from 'lucide-react'

interface QuoteItem {
  id: string
  description: string
  amount: number
  position: number
}

interface Quote {
  id: string
  title: string
  quote_number: string
  status: string
  subtotal: number
  notes: string
  expires_at: string | null
  share_token: string
  share_token_enabled: boolean
  accepted_at: string | null
  couple_id: string
  couple_name: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

export default function QuotePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Form state
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', params.id],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('quotes')
        .select('*, couple:couple_id(name)')
        .eq('id', params.id)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error

      const { data: itemData, error: itemError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', params.id)
        .order('position', { ascending: true })

      if (itemError) throw itemError

      return {
        ...data,
        couple_name: (data.couple as { name: string })?.name ?? '',
      } as Quote & { items: QuoteItem[] }
    },
  })

  // Sync form state when quote loads
  useEffect(() => {
    if (quote) {
      setTitle(quote.title)
      setNotes(quote.notes ?? '')
      setExpiresAt(quote.expires_at ?? '')
      setDirty(false)
    }
  }, [quote?.id])

  // Load items separately
  const { data: quoteItems } = useQuery({
    queryKey: ['quote-items', params.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', params.id)
        .order('position', { ascending: true })
      if (error) throw error
      return (data as QuoteItem[]) || []
    },
  })

  useEffect(() => {
    if (quoteItems) setItems(quoteItems)
  }, [quoteItems])

  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)

  // Save quote + items
  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      // Update quote metadata
      const { error: qErr } = await supabase
        .from('quotes')
        .update({
          title,
          notes: notes || null,
          expires_at: expiresAt || null,
          subtotal,
        })
        .eq('id', params.id)
      if (qErr) throw qErr

      // Sync items: delete all then re-insert
      await supabase.from('quote_items').delete().eq('quote_id', params.id)

      if (items.length > 0) {
        const inserts = items.map((item, i) => ({
          id: item.id.startsWith('new-') ? undefined : item.id,
          quote_id: params.id,
          user_id: user.user!.id,
          description: item.description,
          amount: item.amount,
          position: (i + 1) * 1000,
        }))
        const { error: iErr } = await supabase.from('quote_items').insert(inserts)
        if (iErr) throw iErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', params.id] })
      queryClient.invalidateQueries({ queryKey: ['quote-items', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] })
      toast('Quote saved')
      setDirty(false)
    },
    onError: () => toast('Failed to save quote'),
  })

  // Toggle share link
  const toggleShare = useMutation({
    mutationFn: async (enable: boolean) => {
      const update: Record<string, unknown> = { share_token_enabled: enable }
      if (enable && quote?.status === 'draft') update.status = 'sent'
      const { error } = await supabase.from('quotes').update(update).eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] })
    },
    onError: () => toast('Failed to update share link'),
  })

  // Regenerate share token
  const regenerateToken = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('quotes')
        .update({ share_token: crypto.randomUUID() })
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', params.id] })
      toast('Share link regenerated')
    },
    onError: () => toast('Failed to regenerate link'),
  })

  // Create invoice from this accepted quote
  const createInvoice = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user || !quote) throw new Error('Not authenticated')

      const { data: numData } = await supabase.rpc('generate_invoice_number', {
        p_user_id: user.user.id,
      })

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      const dueDateStr = dueDate.toISOString().split('T')[0]

      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          user_id: user.user.id,
          couple_id: quote.couple_id,
          quote_id: quote.id,
          invoice_number: numData as string,
          title: quote.title,
          status: 'draft',
          subtotal: quote.subtotal,
          due_date: dueDateStr,
          notes: quote.notes,
        })
        .select('id')
        .single()
      if (invErr) throw invErr

      // Copy quote items as invoice items
      if (items.length > 0) {
        const invItems = items.map((item, i) => ({
          invoice_id: inv.id,
          user_id: user.user!.id,
          description: item.description,
          quantity: 1,
          unit_price: item.amount,
          amount: item.amount,
          position: (i + 1) * 1000,
        }))
        await supabase.from('invoice_items').insert(invItems)
      }

      return inv.id as string
    },
    onSuccess: (invId) => {
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      router.push(`/invoices/${invId}`)
    },
    onError: () => toast('Failed to create invoice'),
  })

  const addItem = () => {
    const newItem: QuoteItem = {
      id: `new-${Date.now()}`,
      description: '',
      amount: 0,
      position: (items.length + 1) * 1000,
    }
    setItems((prev) => [...prev, newItem])
    setDirty(true)
  }

  const updateItem = (id: string, field: 'description' | 'amount', value: string | number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
    setDirty(true)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setDirty(true)
  }

  const copyLink = async () => {
    if (!quote) return
    const url = `${window.location.origin}/quote/${quote.share_token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-4">
          <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-9 w-64 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Quote not found.</p>
      </div>
    )
  }

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/quote/${quote.share_token}`
  const isExpired = quote.expires_at && new Date(quote.expires_at + 'T00:00:00') < new Date()
  const effectiveStatus = isExpired && quote.status === 'sent' ? 'expired' : quote.status

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer mb-6"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-400">{quote.quote_number}</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                STATUS_STYLES[effectiveStatus] || STATUS_STYLES.draft
              }`}
            >
              {effectiveStatus}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">{quote.couple_name}</h1>
        </div>
      </div>

      {/* Main form */}
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            placeholder="e.g. Wedding MC Package — Smith Wedding"
            className={inputClass}
          />
        </div>

        {/* Expiry date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Expiry date (optional)</label>
          <DatePicker
            value={expiresAt}
            onChange={(v) => { setExpiresAt(v); setDirty(true) }}
            placeholder="No expiry"
          />
        </div>

        {/* Line items */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Line items</label>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_120px_40px] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500">Description</span>
              <span className="text-xs font-medium text-gray-500 text-right">Amount</span>
              <span />
            </div>

            {items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No line items yet.
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_120px_40px] gap-3 px-4 py-2 border-b border-gray-100 items-center"
              >
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Description"
                  className="text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
                />
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums"
                />
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition cursor-pointer justify-self-center"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}

            {/* Add row */}
            <div className="px-4 py-2">
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <Plus size={14} strokeWidth={1.5} />
                Add item
              </button>
            </div>

            {/* Subtotal */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
            placeholder="Terms, inclusions, exclusions..."
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-5 py-2 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
          >
            {save.isPending ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Share section */}
      <div className="mt-8 border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Share link</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {quote.share_token_enabled
                ? 'Link is active — couple can view and respond'
                : 'Enable to generate a link for the couple'}
            </p>
          </div>
          <button
            onClick={() => toggleShare.mutate(!quote.share_token_enabled)}
            disabled={toggleShare.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
              quote.share_token_enabled ? 'bg-black' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                quote.share_token_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {quote.share_token_enabled && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check size={13} strokeWidth={2} className="text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={13} strokeWidth={1.5} />
                  Copy
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => regenerateToken.mutate()}
            disabled={regenerateToken.isPending}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            Regenerate link
          </button>

          {quote.status === 'accepted' && (
            <button
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending}
              className="ml-auto text-sm px-4 py-1.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
            >
              {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
