'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { DatePicker } from '@/components/ui/date-picker'
import { ArrowLeft, Copy, Check, Trash2, Plus, ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  position: number
}

interface Invoice {
  id: string
  invoice_number: string
  title: string
  status: string
  subtotal: number
  due_date: string | null
  notes: string
  share_token: string
  share_token_enabled: boolean
  paid_at: string | null
  couple_id: string
  event_id: string | null
  couple_name: string
}

interface CoupleEvent {
  id: string
  date: string
  venue: string | null
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [eventId, setEventId] = useState<string | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', params.id],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('invoices')
        .select('*, couple:couple_id(name)')
        .eq('id', params.id)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error

      return {
        ...data,
        couple_name: (data.couple as { name: string })?.name ?? '',
      } as Invoice
    },
  })

  const { data: coupleEvents } = useQuery({
    queryKey: ['couple-events-for-invoice', invoice?.couple_id],
    enabled: !!invoice?.couple_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, date, venue')
        .eq('couple_id', invoice!.couple_id)
        .order('date', { ascending: true })
      if (error) throw error
      return (data as CoupleEvent[]) || []
    },
  })

  const { data: invoiceItems } = useQuery({
    queryKey: ['invoice-items', params.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', params.id)
        .order('position', { ascending: true })
      if (error) throw error
      return (data as InvoiceItem[]) || []
    },
  })

  useEffect(() => {
    if (invoice) {
      setTitle(invoice.title)
      setNotes(invoice.notes ?? '')
      setDueDate(invoice.due_date ?? '')
      setEventId(invoice.event_id)
      setDirty(false)
    }
  }, [invoice?.id])

  useEffect(() => {
    if (invoiceItems) setItems(invoiceItems)
  }, [invoiceItems])

  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          title,
          notes: notes || null,
          due_date: dueDate || null,
          event_id: eventId || null,
          subtotal,
        })
        .eq('id', params.id)
      if (invErr) throw invErr

      await supabase.from('invoice_items').delete().eq('invoice_id', params.id)

      if (items.length > 0) {
        const inserts = items.map((item, i) => ({
          id: item.id.startsWith('new-') ? undefined : item.id,
          invoice_id: params.id,
          user_id: user.user!.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          position: (i + 1) * 1000,
        }))
        const { error: iErr } = await supabase.from('invoice_items').insert(inserts)
        if (iErr) throw iErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', params.id] })
      queryClient.invalidateQueries({ queryKey: ['invoice-items', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      toast('Invoice saved')
      setDirty(false)
    },
    onError: () => toast('Failed to save invoice'),
  })

  const toggleShare = useMutation({
    mutationFn: async (enable: boolean) => {
      const update: Record<string, unknown> = { share_token_enabled: enable }
      if (enable && invoice?.status === 'draft') update.status = 'sent'
      const { error } = await supabase.from('invoices').update(update).eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
    },
    onError: () => toast('Failed to update share link'),
  })

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!invoice) return
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', params.id)
      if (error) throw error

      // Sync events.price if linked
      if (invoice.event_id) {
        await supabase
          .from('events')
          .update({ price: subtotal })
          .eq('id', invoice.event_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      if (invoice?.event_id) {
        queryClient.invalidateQueries({ queryKey: ['couple-events', invoice.couple_id] })
      }
      toast('Invoice marked as paid')
    },
    onError: () => toast('Failed to mark as paid'),
  })

  const cancelInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled', share_token_enabled: false })
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', params.id] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      setCancelConfirm(false)
      toast('Invoice cancelled')
    },
    onError: () => toast('Failed to cancel invoice'),
  })

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: `new-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0,
      position: (items.length + 1) * 1000,
    }
    setItems((prev) => [...prev, newItem])
    setDirty(true)
  }

  const updateItem = (
    id: string,
    field: 'description' | 'quantity' | 'unit_price',
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        updated.amount = Number(updated.quantity) * Number(updated.unit_price)
        return updated
      })
    )
    setDirty(true)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setDirty(true)
  }

  const copyLink = async () => {
    if (!invoice) return
    const url = `${window.location.origin}/invoice/${invoice.share_token}`
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

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Invoice not found.</p>
      </div>
    )
  }

  const isOverdue =
    invoice.due_date &&
    new Date(invoice.due_date + 'T00:00:00') < new Date() &&
    !['paid', 'cancelled'].includes(invoice.status)

  const effectiveStatus = isOverdue ? 'overdue' : invoice.status

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${invoice.share_token}`
  const canEdit = !['paid', 'cancelled'].includes(invoice.status)
  const selectedEvent = coupleEvents?.find((e) => e.id === eventId)

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
            <span className="text-xs font-medium text-gray-400">{invoice.invoice_number}</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                STATUS_STYLES[effectiveStatus] || STATUS_STYLES.draft
              }`}
            >
              {effectiveStatus}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">{invoice.couple_name}</h1>
          {invoice.paid_at && (
            <p className="text-xs text-gray-400 mt-1">
              Paid {new Date(invoice.paid_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
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
            placeholder="e.g. Wedding MC Services — Smith Wedding"
            disabled={!canEdit}
            className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
          />
        </div>

        {/* Due date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Due date</label>
          {canEdit ? (
            <DatePicker
              value={dueDate}
              onChange={(v) => { setDueDate(v); setDirty(true) }}
              placeholder="No due date"
            />
          ) : (
            <p className={`text-sm py-2 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-900'}`}>
              {dueDate ? formatDate(dueDate) : '—'}
            </p>
          )}
        </div>

        {/* Event link */}
        {coupleEvents && coupleEvents.length > 0 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Link to event (optional)</label>
            <Popover.Root open={eventOpen} onOpenChange={setEventOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  disabled={!canEdit}
                  className={`${inputClass} flex items-center justify-between text-left disabled:bg-gray-50 disabled:text-gray-400`}
                >
                  <span className={selectedEvent ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedEvent
                      ? `${formatDate(selectedEvent.date)}${selectedEvent.venue ? ' · ' + selectedEvent.venue : ''}`
                      : 'No event linked'}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                >
                  <button
                    type="button"
                    onClick={() => { setEventId(null); setEventOpen(false); setDirty(true) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
                  >
                    No event linked
                  </button>
                  {coupleEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => { setEventId(event.id); setEventOpen(false); setDirty(true) }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        eventId === event.id ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {formatDate(event.date)}{event.venue ? ` · ${event.venue}` : ''}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            {eventId && (
              <p className="text-xs text-gray-400 mt-1">
                Marking as paid will update this event's price.
              </p>
            )}
          </div>
        )}

        {/* Line items */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Line items</label>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_90px_40px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500">Description</span>
              <span className="text-xs font-medium text-gray-500 text-right">Qty</span>
              <span className="text-xs font-medium text-gray-500 text-right">Unit price</span>
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
                className="grid grid-cols-[1fr_80px_100px_90px_40px] gap-2 px-4 py-2 border-b border-gray-100 items-center"
              >
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Description"
                  disabled={!canEdit}
                  className="text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent disabled:text-gray-400"
                />
                <input
                  type="number"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="1"
                  min="0"
                  step="0.5"
                  disabled={!canEdit}
                  className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums disabled:text-gray-400"
                />
                <input
                  type="number"
                  value={item.unit_price || ''}
                  onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums disabled:text-gray-400"
                />
                <span className="text-sm text-gray-900 text-right tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
                {canEdit && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-gray-300 hover:text-red-400 transition cursor-pointer justify-self-center"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                )}
                {!canEdit && <span />}
              </div>
            ))}

            {canEdit && (
              <div className="px-4 py-2">
                <button
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Add item
                </button>
              </div>
            )}

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
          <label className="block text-sm text-gray-400 mb-1">
            Notes (optional) — payment instructions, bank details
          </label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
            placeholder="Bank: XYZ Bank&#10;BSB: 000-000&#10;Account: 123456789&#10;Reference: Smith Wedding"
            rows={4}
            disabled={!canEdit}
            className={`${inputClass} resize-none disabled:bg-gray-50 disabled:text-gray-400`}
          />
        </div>

        {/* Save */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="px-5 py-2 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
            >
              {save.isPending ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        )}
      </div>

      {/* Share section */}
      <div className="mt-8 border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Share link</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.share_token_enabled
                ? 'Link is active — couple can view payment details'
                : 'Enable to generate a link for the couple'}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => toggleShare.mutate(!invoice.share_token_enabled)}
              disabled={toggleShare.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                invoice.share_token_enabled ? 'bg-black' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  invoice.share_token_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>

        {invoice.share_token_enabled && (
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

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => markPaid.mutate()}
              disabled={markPaid.isPending}
              className="text-sm px-4 py-1.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
            >
              {markPaid.isPending ? 'Saving...' : 'Mark as Paid'}
            </button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setCancelConfirm(true)}
              className="text-sm px-4 py-1.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition cursor-pointer"
            >
              Cancel Invoice
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel Invoice"
        description="Are you sure you want to cancel this invoice? The share link will be disabled."
        onConfirm={() => cancelInvoice.mutate()}
        onCancel={() => setCancelConfirm(false)}
        loading={cancelInvoice.isPending}
      />
    </div>
  )
}
