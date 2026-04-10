'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { InvoicePaymentSchedule } from './invoice-payment-schedule'
import { X, Copy, Check, Trash2, Plus, ChevronDown, Search, ExternalLink, GripVertical, Download } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { generateAndPrintPdf } from '@/lib/generate-pdf'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  title: string
  invoice_number: string
  status: string
  subtotal: number
  notes: string
  due_date: string | null
  payment_terms: string | null
  tax_rate: number
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  deposit_percent: number | null
  deposit_due_date: string | null
  deposit_paid_at: string | null
  final_due_date: string | null
  final_paid_at: string | null
  stripe_payment_enabled: boolean
  paid_at: string | null
  share_token: string
  share_token_enabled: boolean
  couple_id: string
  couple_name: string
  event_id: string | null
}

interface CoupleEvent {
  id: string
  date: string
  venue: string | null
}

interface Couple {
  id: string
  name: string
}

interface QuoteForImport {
  id: string
  title: string
  status: string
  couple_id: string
}

interface InvoiceBuilderModalProps {
  invoiceId: string | null
  initialCoupleId?: string
  isOpen: boolean
  onClose: () => void
  onDelete?: () => void
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
}

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: 'No payment terms' },
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_14', label: 'Net 14' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'custom', label: 'Custom' },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function SortableInvoiceItem({ item, canEdit, onUpdate, onRemove }: {
  item: InvoiceItem
  canEdit: boolean
  onUpdate: (id: string, field: 'description' | 'quantity' | 'unit_price', value: string | number) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[24px_1fr_72px_96px_80px_36px] gap-2 px-4 py-2 border-b border-gray-100 last:border-0 items-center">
      {canEdit ? (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none">
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
      ) : <span />}
      <input
        type="text"
        value={item.description}
        onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
        placeholder="Description"
        disabled={!canEdit}
        className="text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent disabled:text-gray-400"
      />
      <input
        type="number"
        value={item.quantity || ''}
        onChange={(e) => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
        placeholder="1"
        min="0"
        step="0.01"
        disabled={!canEdit}
        className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
        <input
          type="number"
          value={item.unit_price || ''}
          onChange={(e) => onUpdate(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={!canEdit}
          className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums disabled:text-gray-400 pl-3 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <span className="text-sm text-gray-700 text-right tabular-nums">
        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(item.amount)}
      </span>
      {canEdit ? (
        <button onClick={() => onRemove(item.id)} className="p-1 text-gray-300 hover:text-red-400 transition cursor-pointer justify-self-center">
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      ) : <span />}
    </div>
  )
}

export function InvoiceBuilderModal({ invoiceId, initialCoupleId, isOpen, onClose, onDelete }: InvoiceBuilderModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [depositPercent, setDepositPercent] = useState(50)
  const [depositDueDate, setDepositDueDate] = useState('')
  const [finalDueDate, setFinalDueDate] = useState('')
  const [stripePaymentEnabled, setStripePaymentEnabled] = useState(false)
  const [stripeConnectEnabled, setStripeConnectEnabled] = useState(false)
  const [eventId, setEventId] = useState<string | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [coupleSearch, setCoupleSearch] = useState('')
  const [couplePopoverOpen, setCouplePopoverOpen] = useState(false)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [coupleNameForNew, setcoupleNameForNew] = useState<string>('')
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quotePopoverOpen, setQuotePopoverOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [actualInvoiceId, setActualInvoiceId] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftShareToken, setDraftShareToken] = useState<string | null>(null)
  const [draftShareEnabled, setDraftShareEnabled] = useState(false)

  const isNewInvoice = invoiceId === 'new'
  const effectiveInvoiceId = isNewInvoice ? actualInvoiceId : invoiceId
  const taxRate = taxEnabled ? 10 : 0

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', effectiveInvoiceId],
    enabled: !isNewInvoice && !!effectiveInvoiceId,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('invoices')
        .select('*, couple:couple_id(name)')
        .eq('id', effectiveInvoiceId!)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error
      return { ...data, couple_name: (data.couple as { name: string })?.name ?? '' } as Invoice
    },
  })

  const { data: invoiceItems } = useQuery({
    queryKey: ['invoice-items', effectiveInvoiceId],
    enabled: !!effectiveInvoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', effectiveInvoiceId!)
        .order('position', { ascending: true })
      if (error) throw error
      return (data as InvoiceItem[]) || []
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

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-invoice'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('couples')
        .select('id, name')
        .eq('user_id', user.user.id)
        .order('name', { ascending: true })

      if (error) throw error
      return (data as Couple[]) || []
    },
  })

  const effectiveCouple_id = isNewInvoice ? coupleId : invoice?.couple_id

  const { data: quotesForImport } = useQuery({
    queryKey: ['quotes-for-import', effectiveCouple_id],
    enabled: !!effectiveCouple_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, title, status, couple_id, quote_items(description, amount)')
        .eq('couple_id', effectiveCouple_id!)
        .in('status', ['draft', 'sent', 'accepted'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as any[]) || []
    },
  })

  // Load invoice state when editing
  useEffect(() => {
    if (isNewInvoice) {
      setTitle('')
      setNotes('')
      setDueDate('')
      setPaymentTerms('')
      setTaxEnabled(false)
      setDiscountType('percentage')
      setDiscountValue(0)
      setShowDiscount(false)
      setDepositEnabled(false)
      setDepositPercent(50)
      setDepositDueDate('')
      setFinalDueDate('')
      setStripePaymentEnabled(false)
      setEventId(null)
      setCoupleId(null)
      setcoupleNameForNew('')
      setDirty(false)
      const loadSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const meta = user.user_metadata
        setStripeConnectEnabled(!!meta?.stripe_connect_enabled)
      }
      loadSettings()
    } else if (invoice) {
      setTitle(invoice.title)
      setNotes(invoice.notes ?? '')
      setDueDate(invoice.due_date ?? '')
      setPaymentTerms(invoice.payment_terms ?? '')
      setTaxEnabled((invoice.tax_rate ?? 0) > 0)
      setDiscountType((invoice.discount_type as 'percentage' | 'fixed') ?? 'percentage')
      setDiscountValue(invoice.discount_value ?? 0)
      setShowDiscount(!!invoice.discount_type && (invoice.discount_value ?? 0) > 0)
      setDepositEnabled(invoice.deposit_percent != null)
      setDepositPercent(invoice.deposit_percent ?? 50)
      setDepositDueDate(invoice.deposit_due_date ?? '')
      setFinalDueDate(invoice.final_due_date ?? '')
      setStripePaymentEnabled(invoice.stripe_payment_enabled ?? false)
      setEventId(invoice.event_id)
      setCoupleId(invoice.couple_id)
      setDirty(false)
      // Load stripe connect status
      const loadStripeConnect = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setStripeConnectEnabled(!!user.user_metadata?.stripe_connect_enabled)
      }
      loadStripeConnect()
    }
  }, [invoice?.id, isNewInvoice, isOpen])

  useEffect(() => {
    if (invoiceItems) setItems(invoiceItems)
  }, [invoiceItems])

  useEffect(() => {
    if (!isOpen) {
      if (isNewInvoice && actualInvoiceId && !draftSaved) {
        supabase.from('invoices').delete().eq('id', actualInvoiceId)
      }
      setActualInvoiceId(null)
      setDraftSaved(false)
      setDraftShareToken(null)
      setDraftShareEnabled(false)
      setDirty(false)
      setCopied(false)
      setCancelConfirm(false)
    }
  }, [isOpen])

  // Auto-set due date when payment terms change
  const handlePaymentTermsChange = (value: string) => {
    setPaymentTerms(value)
    setDirty(true)
    if (value === 'net_7') setDueDate(addDays(7))
    else if (value === 'net_14') setDueDate(addDays(14))
    else if (value === 'net_30') setDueDate(addDays(30))
    else if (value === 'due_on_receipt') setDueDate('')
    // 'custom' and '' leave dueDate as-is
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const discountAmount = showDiscount && discountValue > 0
    ? (discountType === 'percentage' ? subtotal * discountValue / 100 : discountValue)
    : 0
  const taxableAmount = subtotal - discountAmount
  const tax = taxableAmount * (taxRate / 100)
  const total = taxableAmount + tax

  const depositAmount = depositEnabled ? total * (depositPercent / 100) : 0
  const finalAmount = depositEnabled ? total - depositAmount : 0

  const updateCouple = useMutation({
    mutationFn: async (newCoupleId: string) => {
      const selectedCouple = couples?.find((c) => c.id === newCoupleId)
      if (isNewInvoice) {
        if (!actualInvoiceId) {
          // First couple selection — generate real number and create draft row
          const id = crypto.randomUUID()
          const shareToken = crypto.randomUUID()
          const { data: user } = await supabase.auth.getUser()
          if (!user.user) throw new Error('Not authenticated')
          const { data: numData, error: numError } = await supabase.rpc('generate_invoice_number', { p_user_id: user.user.id })
          if (numError) throw numError
          const { error } = await supabase.from('invoices').insert({
            id,
            user_id: user.user.id,
            couple_id: newCoupleId,
            invoice_number: numData as string,
            title: '',
            notes: null,
            due_date: null,
            payment_terms: null,
            subtotal: 0,
            tax_rate: 0,
            discount_type: null,
            discount_value: null,
            deposit_percent: null,
            deposit_due_date: null,
            final_due_date: null,
            status: 'draft',
            share_token: shareToken,
            share_token_enabled: false,
            stripe_payment_enabled: false,
            event_id: null,
          })
          if (error) throw error
          setActualInvoiceId(id)
          setDraftShareToken(shareToken)
        } else {
          // Changing couple on existing draft
          const { error } = await supabase.from('invoices').update({ couple_id: newCoupleId }).eq('id', actualInvoiceId)
          if (error) throw error
        }
        setCoupleId(newCoupleId)
        if (selectedCouple) setcoupleNameForNew(selectedCouple.name)
      } else {
        const { error } = await supabase
          .from('invoices')
          .update({ couple_id: newCoupleId })
          .eq('id', effectiveInvoiceId!)
        if (error) throw error
      }
    },
    onSuccess: () => {
      if (!isNewInvoice) {
        queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
        queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
        queryClient.invalidateQueries({ queryKey: ['quotes-for-import', invoice?.couple_id] })
      }
      setCouplePopoverOpen(false)
    },
    onError: () => toast('Failed to update couple'),
  })

  // Auto-create draft when opened from couple profile with known coupleId
  useEffect(() => {
    if (isOpen && isNewInvoice && initialCoupleId && !actualInvoiceId && !coupleId && couples) {
      updateCouple.mutate(initialCoupleId)
    }
  }, [isOpen, isNewInvoice, initialCoupleId, actualInvoiceId, coupleId, couples])

  const importFromQuote = (quote: any) => {
    setTitle(quote.title)
    const newItems = (quote.quote_items || []).map((qi: any, i: number) => ({
      id: `new-${Date.now()}-${i}`,
      description: qi.description,
      quantity: 1,
      unit_price: qi.amount,
      amount: qi.amount,
      position: (i + 1) * 1000,
    }))
    setItems(newItems)
    setDirty(true)
    setQuotePopoverOpen(false)
    setQuoteSearch('')
    toast('Quote imported')
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      let finalInvoiceId = effectiveInvoiceId

      if (isNewInvoice) {
        if (!coupleId) throw new Error('Please select a couple')

        // Update the draft invoice with actual data (invoice_number already set at draft creation)
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            title,
            notes: notes || null,
            due_date: dueDate || null,
            payment_terms: paymentTerms || null,
            tax_rate: taxRate,
            discount_type: showDiscount && discountValue > 0 ? discountType : null,
            discount_value: showDiscount && discountValue > 0 ? discountValue : null,
            deposit_percent: depositEnabled ? depositPercent : null,
            deposit_due_date: depositEnabled && depositDueDate ? depositDueDate : null,
            final_due_date: depositEnabled && finalDueDate ? finalDueDate : null,
            event_id: eventId || null,
            subtotal,
          })
          .eq('id', finalInvoiceId!)
        if (invErr) throw invErr
      } else {
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            title,
            notes: notes || null,
            due_date: dueDate || null,
            payment_terms: paymentTerms || null,
            tax_rate: taxRate,
            discount_type: showDiscount && discountValue > 0 ? discountType : null,
            discount_value: showDiscount && discountValue > 0 ? discountValue : null,
            deposit_percent: depositEnabled ? depositPercent : null,
            deposit_due_date: depositEnabled && depositDueDate ? depositDueDate : null,
            final_due_date: depositEnabled && finalDueDate ? finalDueDate : null,
            event_id: eventId || null,
            subtotal,
          })
          .eq('id', effectiveInvoiceId!)
        if (invErr) throw invErr
      }

      await supabase.from('invoice_items').delete().eq('invoice_id', finalInvoiceId!)
      if (items.length > 0) {
        const inserts = items.map((item, i) => {
          const insert: any = {
            invoice_id: finalInvoiceId!,
            user_id: user.user!.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            position: (i + 1) * 1000,
          }
          if (!item.id.startsWith('new-')) {
            insert.id = item.id
          }
          return insert
        })
        const { error: iErr } = await supabase.from('invoice_items').insert(inserts)
        if (iErr) throw iErr
      }

      return finalInvoiceId
    },
    onSuccess: (newInvoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', newInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoice-items', newInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      toast('Invoice saved')
      setDraftSaved(true)
      setDirty(false)
      onClose()
    },
    onError: () => toast('Failed to save invoice'),
  })

  const toggleShare = useMutation({
    mutationFn: async (enable: boolean) => {
      const update: Record<string, unknown> = { share_token_enabled: enable }
      if (enable && !isNewInvoice && invoice?.status === 'draft') update.status = 'sent'
      const { error } = await supabase.from('invoices').update(update).eq('id', effectiveInvoiceId!)
      if (error) throw error
      return enable
    },
    onSuccess: (enable) => {
      if (isNewInvoice) {
        setDraftShareEnabled(enable)
      } else {
        queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
        queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
        queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      }
    },
    onError: () => toast('Failed to update share link'),
  })

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!invoice) return
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', effectiveInvoiceId!)
      if (error) throw error
      if (invoice.event_id) {
        await supabase.from('events').update({ price: total }).eq('id', invoice.event_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      if (invoice?.event_id) {
        queryClient.invalidateQueries({ queryKey: ['couple-events', invoice.couple_id] })
      }
      toast('Invoice marked as paid')
    },
    onError: () => toast('Failed to mark as paid'),
  })

  const markDepositPaid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('invoices')
        .update({ deposit_paid_at: new Date().toISOString() })
        .eq('id', effectiveInvoiceId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
      toast('Deposit marked as paid')
    },
    onError: () => toast('Failed to mark deposit as paid'),
  })

  const markFinalPaid = useMutation({
    mutationFn: async () => {
      if (!invoice) return
      const { error } = await supabase
        .from('invoices')
        .update({ final_paid_at: new Date().toISOString(), status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', effectiveInvoiceId!)
      if (error) throw error
      if (invoice.event_id) {
        await supabase.from('events').update({ price: total }).eq('id', invoice.event_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      if (invoice?.event_id) {
        queryClient.invalidateQueries({ queryKey: ['couple-events', invoice?.couple_id] })
      }
      toast('Final payment marked as paid')
    },
    onError: () => toast('Failed to mark final payment as paid'),
  })

  const toggleStripePayment = useMutation({
    mutationFn: async (enable: boolean) => {
      const { error } = await supabase
        .from('invoices')
        .update({ stripe_payment_enabled: enable })
        .eq('id', effectiveInvoiceId!)
      if (error) throw error
    },
    onSuccess: (_, enable) => {
      setStripePaymentEnabled(enable)
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
    },
    onError: () => toast('Failed to update card payments'),
  })

  const cancelInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled', share_token_enabled: false })
        .eq('id', effectiveInvoiceId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      setCancelConfirm(false)
      toast('Invoice cancelled')
    },
    onError: () => toast('Failed to cancel invoice'),
  })

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, description: '', quantity: 1, unit_price: 0, amount: 0, position: (prev.length + 1) * 1000 },
    ])
    setDirty(true)
  }

  const updateItem = (id: string, field: 'description' | 'quantity' | 'unit_price', value: string | number) => {
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
    await navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoice.share_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadPdf = async () => {
    if (!invoice) return
    const { data: { user } } = await supabase.auth.getUser()
    const meta = user?.user_metadata
    generateAndPrintPdf({
      type: 'invoice',
      documentNumber: invoice.invoice_number,
      title,
      status: invoice.status,
      coupleName: invoice.couple_name,
      businessName: meta?.business_name as string | undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
      subtotal,
      discountType: showDiscount ? discountType : null,
      discountValue: showDiscount ? discountValue : null,
      taxRate,
      total,
      notes: notes || null,
      dueDate: invoice.due_date,
      bankAccountName: meta?.bank_account_name as string | undefined,
      bankBsb: meta?.bank_bsb as string | undefined,
      bankAccountNumber: meta?.bank_account_number as string | undefined,
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (!isOpen || !invoiceId) return null

  const isOverdue =
    invoice?.due_date &&
    new Date(invoice.due_date + 'T00:00:00') < new Date() &&
    !['paid', 'cancelled'].includes(invoice?.status ?? '')
  const effectiveStatus = isOverdue ? 'overdue' : (invoice?.status ?? 'draft')
  const canEdit = !['paid', 'cancelled'].includes(invoice?.status ?? '')
  const activeShareToken = isNewInvoice ? draftShareToken : invoice?.share_token
  const activeShareEnabled = isNewInvoice ? draftShareEnabled : (invoice?.share_token_enabled ?? false)
  const shareUrl = activeShareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${activeShareToken}` : ''
  const selectedEvent = coupleEvents?.find((e) => e.id === eventId)
  const hasDepositSchedule = depositEnabled && !isNewInvoice && !!invoice

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

  const selectedTermsLabel = PAYMENT_TERMS_OPTIONS.find((o) => o.value === paymentTerms)?.label || 'No payment terms'

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id)
        const newIndex = prev.findIndex((i) => i.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
      setDirty(true)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[75]" onClick={onClose} />

      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              {isLoading && !isNewInvoice ? (
                <div className="space-y-1.5">
                  <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {isNewInvoice ? 'New Invoice' : (title || 'Untitled Invoice')}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {invoice?.invoice_number && <span className="text-xs text-gray-400">{invoice.invoice_number}</span>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[effectiveStatus] || STATUS_STYLES.draft}`}>
                      {effectiveStatus}
                    </span>
                    {(invoice?.couple_name || coupleNameForNew) && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500 truncate">{invoice?.couple_name || coupleNameForNew}</span>
                      </>
                    )}
                    {invoice?.paid_at && (
                      <span className="text-xs text-gray-400">
                        · Paid {new Date(invoice.paid_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {canEdit && invoice?.status !== 'cancelled' && !hasDepositSchedule && (
                <button
                  onClick={() => markPaid.mutate()}
                  disabled={markPaid.isPending}
                  className="text-xs text-emerald-600 hover:text-emerald-700 transition cursor-pointer disabled:opacity-50 font-medium px-2 py-1"
                >
                  {markPaid.isPending ? 'Marking...' : 'Mark as Paid'}
                </button>
              )}
              {canEdit && !isNewInvoice && (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="text-xs text-gray-400 hover:text-red-500 transition cursor-pointer px-2 py-1"
                >
                  Cancel
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            {isLoading ? (
              <div className="space-y-5">
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                <div className="flex gap-3">
                  <div className="flex-1 h-10 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="w-44 h-10 bg-gray-100 rounded-xl animate-pulse" />
                </div>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="h-8 bg-gray-50" />
                  <div className="h-12 border-b border-gray-100 bg-white" />
                  <div className="h-12 border-b border-gray-100 bg-white" />
                  <div className="h-12 border-b border-gray-100 bg-white" />
                  <div className="h-12 bg-white" />
                  <div className="h-24 bg-gray-50 border-t border-gray-100" />
                </div>
                <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
                <div className="border border-gray-100 rounded-xl p-4 h-32 bg-white" />
              </div>
            ) : (
              <>
                {/* Couple selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Couple</label>
                  <Popover.Root open={couplePopoverOpen} onOpenChange={setCouplePopoverOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        disabled={!isNewInvoice && !canEdit}
                        className={`${inputClass} flex items-center justify-between text-left disabled:bg-gray-50 disabled:text-gray-400`}
                      >
                        <span className={invoice?.couple_name || coupleNameForNew ? 'text-gray-900' : 'text-gray-400'}>
                          {invoice?.couple_name || coupleNameForNew || 'Select a couple'}
                        </span>
                        <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400 shrink-0 ml-2" />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content className="z-[90] bg-white border border-gray-200 rounded-xl shadow-lg w-[var(--radix-popover-trigger-width)] p-0" sideOffset={4}>
                        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                          <Search size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search couples..."
                            value={coupleSearch}
                            onChange={(e) => setCoupleSearch(e.target.value)}
                            className="flex-1 min-w-0 text-sm focus:outline-none placeholder:text-gray-400"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1">
                          {(couples || [])
                            .filter((c) => !coupleSearch || c.name.toLowerCase().includes(coupleSearch.toLowerCase()))
                            .map((couple) => (
                              <button
                                key={couple.id}
                                onClick={() => updateCouple.mutate(couple.id)}
                                disabled={updateCouple.isPending}
                                className="w-full text-left px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                              >
                                {couple.name}
                              </button>
                            ))}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>

                {/* Import from quote */}
                {quotesForImport && quotesForImport.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Import from quote (optional)</label>
                    <Popover.Root open={quotePopoverOpen} onOpenChange={setQuotePopoverOpen}>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className={`${inputClass} flex items-center justify-between text-left disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          <span className="text-gray-400">Select a quote...</span>
                          <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400 shrink-0 ml-2" />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className="z-[90] bg-white border border-gray-200 rounded-xl shadow-lg w-[var(--radix-popover-trigger-width)] p-0" sideOffset={4}>
                          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                            <Search size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search quotes..."
                              value={quoteSearch}
                              onChange={(e) => setQuoteSearch(e.target.value)}
                              className="flex-1 min-w-0 text-sm focus:outline-none placeholder:text-gray-400"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            {(quotesForImport || [])
                              .filter((q) => !quoteSearch || q.title.toLowerCase().includes(quoteSearch.toLowerCase()))
                              .map((quote) => (
                                <button
                                  key={quote.id}
                                  onClick={() => importFromQuote(quote)}
                                  className="w-full text-left px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                                >
                                  <div className="font-medium">{quote.title}</div>
                                  <div className="text-xs text-gray-400 capitalize">{quote.status}</div>
                                </button>
                              ))}
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                    placeholder="e.g. Wedding MC Services — Smith Wedding"
                    disabled={!canEdit}
                    className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                </div>

                {/* Payment terms + Due date */}
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment terms</label>
                    <Popover.Root open={termsOpen} onOpenChange={setTermsOpen}>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className={`${inputClass} flex items-center justify-between text-left disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          <span className={paymentTerms ? 'text-gray-900' : 'text-gray-400'}>
                            {selectedTermsLabel}
                          </span>
                          <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400 shrink-0 ml-2" />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className="z-[90] bg-white border border-gray-200 rounded-xl shadow-lg w-[var(--radix-popover-trigger-width)] p-1" sideOffset={4}>
                          {PAYMENT_TERMS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { handlePaymentTermsChange(opt.value); setTermsOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition cursor-pointer hover:bg-gray-50 ${paymentTerms === opt.value ? 'text-gray-900 font-medium' : 'text-gray-700'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                  <div className="w-44 shrink-0">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Due date</label>
                    {canEdit && paymentTerms !== 'due_on_receipt' ? (
                      <DatePicker
                        value={dueDate}
                        onChange={(date) => {
                          setDueDate(date)
                          if (paymentTerms !== 'custom') setPaymentTerms('custom')
                          setDirty(true)
                        }}
                        placeholder="Select date"
                      />
                    ) : (
                      <p className={`text-sm py-2 ${isOverdue ? 'text-red-500 font-medium' : paymentTerms === 'due_on_receipt' ? 'text-gray-400' : 'text-gray-900'}`}>
                        {paymentTerms === 'due_on_receipt'
                          ? 'Due on receipt'
                          : dueDate
                          ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Event link */}
                {coupleEvents && coupleEvents.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Link to event (optional)</label>
                    <Popover.Root open={eventOpen} onOpenChange={setEventOpen}>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className={`${inputClass} flex items-center justify-between text-left disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          <span className={selectedEvent ? 'text-gray-900' : 'text-gray-400'}>
                            {selectedEvent
                              ? `${new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}${selectedEvent.venue ? ` · ${selectedEvent.venue}` : ''}`
                              : 'No event linked'}
                          </span>
                          <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400 shrink-0 ml-2" />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="z-[90] bg-white border border-gray-200 rounded-xl shadow-lg p-1 w-[var(--radix-popover-trigger-width)]"
                          sideOffset={4}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                            onClick={() => { setEventId(null); setEventOpen(false); setDirty(true) }}
                          >
                            No event
                          </button>
                          {coupleEvents.map((event) => (
                            <button
                              key={event.id}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                              onClick={() => { setEventId(event.id); setEventOpen(false); setDirty(true) }}
                            >
                              {new Date(event.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {event.venue && <span className="text-gray-400"> · {event.venue}</span>}
                            </button>
                          ))}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                )}

                {/* Line items */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Line items</label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[24px_1fr_72px_96px_80px_36px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span />
                      <span className="text-xs font-medium text-gray-500">Description</span>
                      <span className="text-xs font-medium text-gray-500 text-right">Qty</span>
                      <span className="text-xs font-medium text-gray-500 text-right">Unit price</span>
                      <span className="text-xs font-medium text-gray-500 text-right">Amount</span>
                      <span />
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {items.map((item) => (
                          <SortableInvoiceItem key={item.id} item={item} canEdit={canEdit} onUpdate={updateItem} onRemove={removeItem} />
                        ))}
                      </SortableContext>
                    </DndContext>
                    {canEdit && (
                      <div className="px-4 py-3">
                        <button
                          onClick={addItem}
                          className="w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-500 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus size={14} strokeWidth={1.5} /> Add item
                        </button>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="space-y-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Subtotal</span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(subtotal)}</span>
                      </div>
                      {showDiscount ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {canEdit && (
                              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs shrink-0">
                                <button
                                  onClick={() => { setDiscountType('percentage'); setDirty(true) }}
                                  className={`px-2 py-1 transition cursor-pointer ${discountType === 'percentage' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                >%</button>
                                <button
                                  onClick={() => { setDiscountType('fixed'); setDirty(true) }}
                                  className={`px-2 py-1 transition cursor-pointer ${discountType === 'fixed' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                >$</button>
                              </div>
                            )}
                            {canEdit && (
                              <div className="relative flex-1 max-w-[80px]">
                                {discountType === 'fixed' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>}
                                <input
                                  type="number"
                                  value={discountValue || ''}
                                  onChange={(e) => { setDiscountValue(parseFloat(e.target.value) || 0); setDirty(true) }}
                                  placeholder="0"
                                  min="0"
                                  step="0.01"
                                  className={`w-full text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-green-300 focus:ring-1 focus:ring-green-100 transition tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${discountType === 'fixed' ? 'pl-5 pr-2' : 'px-2'}`}
                                />
                                {discountType === 'percentage' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>}
                              </div>
                            )}
                            <span className="text-xs text-gray-400">Discount</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-semibold text-red-500 tabular-nums">-{formatCurrency(discountAmount)}</span>
                            {canEdit && (
                              <button
                                onClick={() => { setShowDiscount(false); setDiscountValue(0); setDirty(true) }}
                                className="text-gray-300 hover:text-gray-500 transition cursor-pointer"
                              >
                                <X size={13} strokeWidth={1.5} />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : canEdit && (
                        <button
                          onClick={() => { setShowDiscount(true); setDirty(true) }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={12} strokeWidth={1.5} /> Add discount
                        </button>
                      )}
                      {/* GST toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">GST (10%)</span>
                          {canEdit && (
                            <button
                              onClick={() => { setTaxEnabled((v) => !v); setDirty(true) }}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${taxEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${taxEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                            </button>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(tax)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Total</span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                    placeholder="Payment instructions, BSB, account number..."
                    rows={4}
                    disabled={!canEdit}
                    className={`${inputClass} resize-none disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                </div>

                {/* Payment schedule */}
                {!isNewInvoice && invoice && (
                  <InvoicePaymentSchedule
                    invoiceId={invoiceId!}
                    canEdit={canEdit}
                    depositEnabled={depositEnabled}
                    depositPercent={depositPercent}
                    depositDueDate={depositDueDate}
                    finalDueDate={finalDueDate}
                    depositPaidAt={invoice.deposit_paid_at}
                    finalPaidAt={invoice.final_paid_at}
                    depositAmount={depositAmount}
                    finalAmount={finalAmount}
                    onDepositEnabledChange={(v) => { setDepositEnabled(v); setDirty(true) }}
                    onDepositPercentChange={(v) => { setDepositPercent(v); setDirty(true) }}
                    onDepositDueDateChange={(v) => { setDepositDueDate(v); setDirty(true) }}
                    onFinalDueDateChange={(v) => { setFinalDueDate(v); setDirty(true) }}
                    onMarkDepositPaid={() => markDepositPaid.mutate()}
                    onMarkFinalPaid={() => markFinalPaid.mutate()}
                    markDepositPending={markDepositPaid.isPending}
                    markFinalPending={markFinalPaid.isPending}
                  />
                )}

                {/* Share section */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Share link</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {activeShareEnabled ? 'Active — couple can view this invoice' : 'Enable to share with the couple'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleShare.mutate(!activeShareEnabled)}
                      disabled={toggleShare.isPending || (!isNewInvoice && !canEdit) || (isNewInvoice && !actualInvoiceId)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${activeShareEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${activeShareEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {activeShareEnabled && (
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
                        {copied ? <><Check size={13} strokeWidth={2} className="text-emerald-500" />Copied</> : <><Copy size={13} strokeWidth={1.5} />Copy</>}
                      </button>
                    </div>
                  )}

                  {!isNewInvoice && (
                    <div className="pt-1">
                      <button onClick={downloadPdf}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">
                        <Download size={12} strokeWidth={1.5} /> Download PDF
                      </button>
                    </div>
                  )}

                  {/* Stripe card payments toggle */}
                  {!isNewInvoice && (
                    <div className="pt-1 border-t border-gray-100">
                      {stripeConnectEnabled ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Accept card payments</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {depositEnabled ? 'Not available with a payment schedule' : 'Couples can pay by credit card'}
                            </p>
                          </div>
                          <button
                            onClick={() => !depositEnabled && toggleStripePayment.mutate(!stripePaymentEnabled)}
                            disabled={toggleStripePayment.isPending || !canEdit || depositEnabled}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${stripePaymentEnabled && !depositEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${stripePaymentEnabled && !depositEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Accept card payments</p>
                            <p className="text-xs text-gray-400 mt-0.5">Connect Stripe to enable card payments</p>
                          </div>
                          <a
                            href="/settings?tab=payments"
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition"
                          >
                            Set up <ExternalLink size={12} strokeWidth={1.5} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {canEdit && (
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
              {onDelete ? (
                <button onClick={onDelete}
                  className="text-sm px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer">
                  Delete
                </button>
              ) : <span />}
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className={`px-5 py-2 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50 ${!dirty && !save.isPending ? 'opacity-40' : ''}`}
              >
                {save.isPending ? 'Saving...' : dirty ? 'Save changes' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel invoice?"
        description="This will cancel the invoice and disable the share link. This cannot be undone."
        confirmLabel="Cancel invoice"
        onConfirm={() => cancelInvoice.mutate()}
        onCancel={() => setCancelConfirm(false)}
      />
    </>
  )
}
