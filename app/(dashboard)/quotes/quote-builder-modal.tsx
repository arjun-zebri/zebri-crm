'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { DatePicker } from '@/components/ui/date-picker'
import { X, Copy, Check, RefreshCw, Trash2, Plus, Search, ChevronDown, GripVertical, Download } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { generateAndPrintPdf } from '@/lib/generate-pdf'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  tax_rate: number | null
}

interface Couple {
  id: string
  name: string
}

interface QuoteTemplate {
  id: string
  name: string
  notes: string | null
}

interface QuoteTemplateItem {
  id: string
  template_id: string
  description: string
  amount: number
  position: number
}

interface QuoteBuilderModalProps {
  quoteId: string | null
  isOpen: boolean
  onClose: () => void
  onCreateInvoice?: (invoiceId: string) => void
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

function SortableQuoteItem({ item, onUpdate, onRemove }: { item: QuoteItem; onUpdate: (id: string, field: 'description' | 'amount', value: string | number) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[24px_1fr_110px_36px] gap-3 px-4 py-2 border-b border-gray-100 items-center">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none">
        <GripVertical size={14} strokeWidth={1.5} />
      </button>
      <input type="text" value={item.description}
        onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
        placeholder="Description"
        className="text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent" />
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
        <input type="number" value={item.amount || ''}
          onChange={(e) => onUpdate(item.id, 'amount', parseFloat(e.target.value) || 0)}
          placeholder="0.00" min="0" step="0.01"
          className="text-sm text-gray-900 text-right placeholder:text-gray-400 focus:outline-none bg-transparent tabular-nums w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      </div>
      <button onClick={() => onRemove(item.id)}
        className="p-1 text-gray-300 hover:text-red-400 transition cursor-pointer justify-self-center">
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export function QuoteBuilderModal({ quoteId, isOpen, onClose, onCreateInvoice }: QuoteBuilderModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [coupleSearch, setCoupleSearch] = useState('')
  const [couplePopoverOpen, setCouplePopoverOpen] = useState(false)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [coupleNameForNew, setcoupleNameForNew] = useState<string>('')
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [showDiscount, setShowDiscount] = useState(false)

  const isNewQuote = quoteId === 'new'

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', quoteId],
    enabled: !!quoteId && !isNewQuote,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('quotes')
        .select('*, couple:couple_id(name)')
        .eq('id', quoteId!)
        .eq('user_id', user.user.id)
        .single()

      if (error) throw error
      return { ...data, couple_name: (data.couple as { name: string })?.name ?? '' } as Quote
    },
  })

  const { data: quoteItems } = useQuery({
    queryKey: ['quote-items', quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('position', { ascending: true })
      if (error) throw error
      return (data as QuoteItem[]) || []
    },
  })

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-quote'],
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

  const { data: templates } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return []
      const { data, error } = await supabase
        .from('quote_templates')
        .select('id, name, notes')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true })
      if (error) throw error
      return (data as QuoteTemplate[]) || []
    },
  })

  const { data: templateItems } = useQuery({
    queryKey: ['quote-template-items'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return {}
      const { data, error } = await supabase
        .from('quote_template_items')
        .select('*')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true })
      if (error) throw error
      const grouped: Record<string, QuoteTemplateItem[]> = {}
      ;(data || []).forEach((item: any) => {
        if (!grouped[item.template_id]) grouped[item.template_id] = []
        grouped[item.template_id].push(item)
      })
      return grouped
    },
  })

  useEffect(() => {
    if (isNewQuote) {
      setTitle('')
      setNotes('')
      setExpiresAt('')
      setCoupleId(null)
      setcoupleNameForNew('')
      setTaxEnabled(true)
      setDiscountType('percentage')
      setDiscountValue(0)
      setShowDiscount(false)
      setDirty(false)
    } else if (quote) {
      setTitle(quote.title)
      setNotes(quote.notes ?? '')
      setExpiresAt(quote.expires_at ?? '')
      setCoupleId(quote.couple_id)
      setTaxEnabled((quote.tax_rate ?? 10) > 0)
      setDiscountType((quote.discount_type as 'percentage' | 'fixed') ?? 'percentage')
      setDiscountValue(quote.discount_value ?? 0)
      setShowDiscount(!!quote.discount_type && (quote.discount_value ?? 0) > 0)
      setDirty(false)
    }
  }, [quote?.id, isNewQuote, isOpen])

  useEffect(() => {
    if (quoteItems) setItems(quoteItems)
  }, [quoteItems])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setDirty(false)
      setCopied(false)
    }
  }, [isOpen])

  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const taxRate = taxEnabled ? 10 : 0
  const discountAmount = showDiscount && discountValue > 0
    ? (discountType === 'percentage' ? subtotal * discountValue / 100 : discountValue)
    : 0
  const taxableAmount = subtotal - discountAmount
  const tax = taxableAmount * (taxRate / 100)
  const total = taxableAmount + tax

  const updateCouple = useMutation({
    mutationFn: async (newCoupleId: string) => {
      if (isNewQuote) {
        setCoupleId(newCoupleId)
        const selectedCouple = couples?.find((c) => c.id === newCoupleId)
        if (selectedCouple) setcoupleNameForNew(selectedCouple.name)
      } else {
        const { error } = await supabase
          .from('quotes')
          .update({ couple_id: newCoupleId })
          .eq('id', quoteId!)
        if (error) throw error
      }
    },
    onSuccess: () => {
      if (!isNewQuote) {
        queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
        queryClient.invalidateQueries({ queryKey: ['all-quotes'] })
      }
      setCouplePopoverOpen(false)
    },
    onError: () => toast('Failed to update couple'),
  })

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      let finalQuoteId = quoteId

      if (isNewQuote) {
        if (!coupleId) throw new Error('Please select a couple')

        const { data: numData } = await supabase.rpc('generate_quote_number', { p_user_id: user.user.id })

        const { data: newQuote, error: qErr } = await supabase
          .from('quotes')
          .insert({
            user_id: user.user.id,
            couple_id: coupleId,
            quote_number: numData as string,
            title,
            notes: notes || null,
            expires_at: expiresAt || null,
            subtotal,
            tax_rate: taxRate,
            discount_type: showDiscount && discountValue > 0 ? discountType : null,
            discount_value: showDiscount && discountValue > 0 ? discountValue : null,
            status: 'draft',
            share_token: crypto.randomUUID(),
            share_token_enabled: false,
          })
          .select('id')
          .single()
        if (qErr) throw qErr
        finalQuoteId = newQuote.id
      } else {
        const { error: qErr } = await supabase
          .from('quotes')
          .update({
            title,
            notes: notes || null,
            expires_at: expiresAt || null,
            subtotal,
            tax_rate: taxRate,
            discount_type: showDiscount && discountValue > 0 ? discountType : null,
            discount_value: showDiscount && discountValue > 0 ? discountValue : null,
          })
          .eq('id', quoteId!)
        if (qErr) throw qErr
      }

      await supabase.from('quote_items').delete().eq('quote_id', finalQuoteId!)
      if (items.length > 0) {
        const inserts = items.map((item, i) => {
          const insert: any = {
            quote_id: finalQuoteId!,
            user_id: user.user!.id,
            description: item.description,
            amount: item.amount,
            position: (i + 1) * 1000,
          }
          if (!item.id.startsWith('new-')) {
            insert.id = item.id
          }
          return insert
        })
        const { error: iErr } = await supabase.from('quote_items').insert(inserts)
        if (iErr) throw iErr
      }

      return finalQuoteId
    },
    onSuccess: (newQuoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote', newQuoteId] })
      queryClient.invalidateQueries({ queryKey: ['quote-items', newQuoteId] })
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] })
      queryClient.invalidateQueries({ queryKey: ['all-quotes'] })
      toast('Quote saved')
      setDirty(false)
      onClose()
    },
    onError: () => toast('Failed to save quote'),
  })

  const toggleShare = useMutation({
    mutationFn: async (enable: boolean) => {
      const update: Record<string, unknown> = { share_token_enabled: enable }
      if (enable && quote?.status === 'draft') update.status = 'sent'
      const { error } = await supabase.from('quotes').update(update).eq('id', quoteId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] })
      queryClient.invalidateQueries({ queryKey: ['all-quotes'] })
    },
    onError: () => toast('Failed to update share link'),
  })

  const regenerateToken = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('quotes')
        .update({ share_token: crypto.randomUUID() })
        .eq('id', quoteId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      toast('Share link regenerated')
    },
    onError: () => toast('Failed to regenerate link'),
  })

  const createInvoice = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user || !quote) throw new Error('Not authenticated')

      const { data: numData } = await supabase.rpc('generate_invoice_number', { p_user_id: user.user.id })

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
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] })
      onCreateInvoice?.(invId)
    },
    onError: () => toast('Failed to create invoice'),
  })

  const addItem = () => {
    setItems((prev) => [...prev, { id: `new-${Date.now()}`, description: '', amount: 0, position: (prev.length + 1) * 1000 }])
    setDirty(true)
  }

  const updateItem = (id: string, field: 'description' | 'amount', value: string | number) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item))
    setDirty(true)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setDirty(true)
  }

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

  const copyLink = async () => {
    if (!quote) return
    await navigator.clipboard.writeText(`${window.location.origin}/quote/${quote.share_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadPdf = async () => {
    if (!quote) return
    const { data: { user } } = await supabase.auth.getUser()
    const businessName = user?.user_metadata?.business_name as string | undefined
    generateAndPrintPdf({
      type: 'quote',
      documentNumber: quote.quote_number,
      title,
      status: quote.status,
      coupleName: quote.couple_name,
      businessName,
      items: items.map((item) => ({ description: item.description, amount: item.amount })),
      subtotal,
      discountType: showDiscount ? discountType : null,
      discountValue: showDiscount ? discountValue : null,
      taxRate,
      total,
      notes: notes || null,
      expiresAt: quote.expires_at,
    })
  }

  if (!isOpen || !quoteId) return null

  const shareUrl = quote ? `${typeof window !== 'undefined' ? window.location.origin : ''}/quote/${quote.share_token}` : ''
  const isExpired = quote?.expires_at && new Date(quote.expires_at + 'T00:00:00') < new Date()
  const effectiveStatus = isExpired && quote?.status === 'sent' ? 'expired' : (quote?.status ?? 'draft')

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[75]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              {isLoading && !isNewQuote ? (
                <div className="space-y-1.5">
                  <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {isNewQuote ? 'New Quote' : (title || 'Untitled Quote')}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {quote?.quote_number && <span className="text-xs text-gray-400">{quote.quote_number}</span>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[effectiveStatus] || STATUS_STYLES.draft}`}>
                      {effectiveStatus}
                    </span>
                    {(quote?.couple_name || coupleNameForNew) && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500 truncate">{quote?.couple_name || coupleNameForNew}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer shrink-0 ml-3">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            {isLoading ? (
              <div className="space-y-5">
                {/* Couple */}
                <div className="space-y-1.5">
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                </div>
                {/* Title + Expiry */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  </div>
                </div>
                {/* Line items */}
                <div className="space-y-1.5">
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="h-9 bg-gray-50 border-b border-gray-200" />
                    {[1, 2, 3].map(i => <div key={i} className="h-11 border-b border-gray-200 bg-white" />)}
                    <div className="px-4 py-3 space-y-2 bg-gray-50">
                      <div className="flex justify-between">
                        <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                      </div>
                      <div className="flex justify-between">
                        <div className="h-4 w-10 bg-gray-100 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Notes */}
                <div className="space-y-1.5">
                  <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                  <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                </div>
                {/* Share section */}
                <div className="border border-gray-200 rounded-xl p-4 h-20 bg-white" />
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
                        className={`${inputClass} flex items-center justify-between text-left`}
                      >
                        <span className={quote?.couple_name || coupleNameForNew ? 'text-gray-900' : 'text-gray-400'}>
                          {quote?.couple_name || coupleNameForNew || 'Select a couple'}
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

                {/* Title + Expiry */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
                    <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                      placeholder="e.g. Wedding MC Package" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Expiry date</label>
                    <DatePicker
                      value={expiresAt}
                      onChange={(date) => {
                        setExpiresAt(date)
                        setDirty(true)
                      }}
                      placeholder="Select date"
                      inline
                    />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-500">Line items</label>
                    <Popover.Root open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
                        >
                          Apply template <ChevronDown size={11} strokeWidth={1.5} />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className="z-[90] bg-white border border-gray-200 rounded-xl shadow-lg w-64 p-0" sideOffset={4} align="end">
                          {(templates?.length ?? 0) === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-3">No templates yet. Create one in Settings.</p>
                          ) : (
                            <>
                              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                                <Search size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search templates..."
                                  value={templateSearch}
                                  onChange={(e) => setTemplateSearch(e.target.value)}
                                  className="flex-1 min-w-0 text-sm focus:outline-none placeholder:text-gray-400"
                                />
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1">
                                {(templates || [])
                                  .filter((t) => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                  .map((template) => {
                                    const tItems = templateItems?.[template.id] || []
                                    const tTotal = tItems.reduce((sum, ti) => sum + (ti.amount || 0), 0)
                                    return (
                                      <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => {
                                          const newItems = tItems.map((ti, i) => ({
                                            id: `new-${Date.now()}-${i}`,
                                            description: ti.description,
                                            amount: ti.amount,
                                            position: (i + 1) * 1000,
                                          }))
                                          setItems(newItems)
                                          if (template.notes) setNotes(template.notes)
                                          setDirty(true)
                                          setTemplatePopoverOpen(false)
                                          setTemplateSearch('')
                                        }}
                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition cursor-pointer flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-sm text-gray-900 truncate">{template.name}</p>
                                          <p className="text-xs text-gray-400 mt-0.5">{tItems.length} item{tItems.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        {tTotal > 0 && (
                                          <span className="text-xs font-medium text-gray-600 shrink-0">{formatCurrency(tTotal)}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                {(templates || []).filter((t) => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                                  <p className="text-xs text-gray-400 px-3 py-2.5">No templates found</p>
                                )}
                              </div>
                            </>
                          )}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[24px_1fr_110px_36px] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span />
                      <span className="text-xs font-medium text-gray-500">Description</span>
                      <span className="text-xs font-medium text-gray-500 text-right">Amount</span>
                      <span />
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {items.map((item) => (
                          <SortableQuoteItem key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <div className="px-4 py-3">
                      <button
                        onClick={addItem}
                        className="w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-500 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} strokeWidth={1.5} /> Add item
                      </button>
                    </div>
                    <div className="space-y-2 px-4 py-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">Subtotal</span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(subtotal)}</span>
                      </div>
                      {showDiscount ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
                            <span className="text-xs text-gray-400">Discount</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-semibold text-red-500 tabular-nums">-{formatCurrency(discountAmount)}</span>
                            <button
                              onClick={() => { setShowDiscount(false); setDiscountValue(0); setDirty(true) }}
                              className="text-gray-300 hover:text-gray-500 transition cursor-pointer"
                            >
                              <X size={13} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowDiscount(true); setDirty(true) }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={12} strokeWidth={1.5} /> Add discount
                        </button>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600">GST (10%)</span>
                          <button
                            onClick={() => { setTaxEnabled((v) => !v); setDirty(true) }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${taxEnabled ? 'bg-green-500' : 'bg-gray-200'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${taxEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
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
                  <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                    placeholder="Terms, inclusions, exclusions..." rows={4}
                    className={`${inputClass} resize-none`} />
                </div>

                {/* Share section */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Share link</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {quote?.share_token_enabled ? 'Active — couple can view and respond' : 'Enable to share with the couple'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleShare.mutate(!quote?.share_token_enabled)}
                      disabled={toggleShare.isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${quote?.share_token_enabled ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${quote?.share_token_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {quote?.share_token_enabled && (
                    <div className="flex items-center gap-2">
                      <input type="text" readOnly value={shareUrl}
                        className="flex-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none truncate" />
                      <button onClick={copyLink}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer shrink-0">
                        {copied ? <><Check size={13} strokeWidth={2} className="text-emerald-500" />Copied</> : <><Copy size={13} strokeWidth={1.5} />Copy</>}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-0.5">
                    <button onClick={() => regenerateToken.mutate()} disabled={regenerateToken.isPending}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50">
                      <RefreshCw size={12} strokeWidth={1.5} /> Regenerate link
                    </button>
                    {!isNewQuote && (
                      <button onClick={downloadPdf}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">
                        <Download size={12} strokeWidth={1.5} /> Download PDF
                      </button>
                    )}
                    {quote?.status === 'accepted' && onCreateInvoice && (
                      <button onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}
                        className="ml-auto text-sm px-4 py-1.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50">
                        {createInvoice.isPending ? 'Creating...' : 'Create Invoice →'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end">
            <button onClick={() => save.mutate()} disabled={save.isPending}
              className={`px-5 py-2 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50 ${!dirty && !save.isPending ? 'opacity-40' : ''}`}>
              {save.isPending ? 'Saving...' : dirty ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
