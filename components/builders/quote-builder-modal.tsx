/**
 * Quote builder modal.
 *
 * Composition over the new `components/builders/parts/*` set:
 * - `BuilderModalShell` — modal frame + hero title + state pill +
 *   ⋯ overflow menu (Delete + optional "Convert to invoice").
 * - `BuilderMetaRow` — couple picker + expiry date.
 * - `TemplatePicker` — empty-state card when no items, inline link
 *   in the items header once items exist.
 * - `LineItemsTable` — description + amount only (no quantity).
 * - `DiscountControl` + `TaxControl` — inline affordances.
 * - `TotalsPanel` — subtotal / discount / GST / total.
 * - `NotesField` — terms / notes textarea.
 * - `ShareAndSend` — footer with primary "Send to couple" CTA.
 *
 * Saves now flow through `saveQuoteAction` (server action with
 * Zod-validated input + RLS-scoped Supabase). No more inline
 * `supabase.from('quotes').update(...)` in this file.
 *
 * @module components/builders/quote-builder-modal
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  deleteQuoteAction,
  saveQuoteAction,
  type SaveQuoteInput,
} from '@/app/(dashboard)/payments/actions';
import { BuilderMetaRow } from '@/components/builders/parts/builder-meta-row';
import {
  type BuilderModalPrimaryAction,
  BuilderModalShell,
  type OverflowMenuItem,
} from '@/components/builders/parts/builder-modal-shell';
import { BuilderPreviewPane } from '@/components/builders/parts/builder-preview-pane';
import { DiscountControl } from '@/components/builders/parts/discount-control';
import {
  type LineItem,
  LineItemsTable,
} from '@/components/builders/parts/line-items-table';
import { NotesField } from '@/components/builders/parts/notes-field';
import type { PreviewDoc } from '@/components/builders/parts/preview-shared';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { TaxControl } from '@/components/builders/parts/tax-control';
import {
  type QuoteTemplate,
  TemplatePicker,
} from '@/components/builders/parts/template-picker';
import { TotalsPanel } from '@/components/builders/parts/totals-panel';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StatePillProps } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

interface Quote {
  id: string;
  title: string;
  quote_number: string;
  status: string;
  subtotal: number;
  notes: string | null;
  expires_at: string | null;
  share_token: string;
  share_token_enabled: boolean;
  email_sent_at: string | null;
  couple_id: string;
  couple_name: string;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  tax_rate: number | null;
}

interface DbQuoteTemplate {
  id: string;
  name: string;
  notes: string | null;
}

interface DbQuoteTemplateItem {
  id: string;
  template_id: string;
  description: string;
  amount: number;
  position: number;
}

export interface QuoteBuilderModalProps {
  quoteId: string | null;
  initialCoupleId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCreateInvoice?: (invoiceId: string) => void;
  onDelete?: () => void;
}

const STATE_PILL: Record<string, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  accepted: { label: 'Accepted', tone: 'success', dot: 'filled' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export function QuoteBuilderModal({
  quoteId,
  initialCoupleId,
  isOpen,
  onClose,
  onCreateInvoice,
  onDelete,
}: QuoteBuilderModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isNewQuote = quoteId === 'new' || quoteId === null;
  const effectiveId = isNewQuote ? null : quoteId;

  /* ─── form state ────────────────────────────────────────────── */
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState<string | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  /* ─── data ──────────────────────────────────────────────────── */
  const { data: quote } = useQuery({
    queryKey: ['quote', effectiveId],
    enabled: !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, couple:couple_id(name)')
        .eq('id', effectiveId!)
        .single();
      if (error) throw error;
      const couple = (data.couple as { name: string } | null) ?? null;
      return { ...data, couple_name: couple?.name ?? '' } as Quote;
    },
  });

  const { data: dbItems } = useQuery({
    queryKey: ['quote-items', effectiveId],
    enabled: !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', effectiveId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as LineItem[]) ?? [];
    },
  });

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-quote'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];
      const { data, error } = await supabase
        .from('couples')
        .select('id, name')
        .eq('user_id', user.user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['quote-templates-with-items'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { templates: [] as DbQuoteTemplate[], items: {} as Record<string, DbQuoteTemplateItem[]> };
      const { data: tpls } = await supabase
        .from('quote_templates')
        .select('id, name, notes')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true });
      const { data: tplItems } = await supabase
        .from('quote_template_items')
        .select('*')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true });
      const grouped: Record<string, DbQuoteTemplateItem[]> = {};
      (tplItems ?? []).forEach((item) => {
        if (!grouped[item.template_id]) grouped[item.template_id] = [];
        grouped[item.template_id]!.push(item as DbQuoteTemplateItem);
      });
      return { templates: (tpls ?? []) as DbQuoteTemplate[], items: grouped };
    },
  });

  /* ─── hydrate state from DB ─────────────────────────────────── */
  useEffect(() => {
    if (isNewQuote) {
      setTitle('');
      setNotes('');
      setExpiresAt(null);
      setItems([]);
      setCoupleId(initialCoupleId ?? null);
      setCoupleName(
        initialCoupleId ? couples?.find((c) => c.id === initialCoupleId)?.name ?? null : null,
      );
      setTaxEnabled(true);
      setDiscountType(null);
      setDiscountValue(null);
      setDirty(false);
      return;
    }
    if (quote) {
      setTitle(quote.title);
      setNotes(quote.notes ?? '');
      setExpiresAt(quote.expires_at);
      setCoupleId(quote.couple_id);
      setCoupleName(quote.couple_name);
      setTaxEnabled((quote.tax_rate ?? 10) > 0);
      setDiscountType(quote.discount_type);
      setDiscountValue(quote.discount_value);
      setDirty(false);
    }
  }, [quote?.id, isNewQuote, initialCoupleId, couples]);

  useEffect(() => {
    if (dbItems) setItems(dbItems);
  }, [dbItems]);

  /* ─── computed ──────────────────────────────────────────────── */
  const subtotal = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const discountAmount =
    discountType && discountValue != null && discountValue > 0
      ? discountType === 'percentage'
        ? (subtotal * discountValue) / 100
        : discountValue
      : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxRate = taxEnabled ? 10 : 0;
  const tax = taxableAmount * (taxRate / 100);
  const total = taxableAmount + tax;

  const status = quote?.status ?? 'draft';
  const canEdit = !['accepted', 'declined', 'expired'].includes(status);
  const shareEnabled = quote?.share_token_enabled ?? false;
  const shareUrl =
    typeof window !== 'undefined' && quote?.share_token
      ? `${window.location.origin}/quote/${quote.share_token}`
      : null;

  /* ─── mutations ─────────────────────────────────────────────── */

  const save = useMutation({
    mutationFn: async () => {
      if (!coupleId) throw new Error('Please select a couple first');
      const input: SaveQuoteInput = {
        quoteId: effectiveId,
        coupleId,
        title,
        notes: notes || null,
        expiresAt: expiresAt,
        taxRate,
        discount:
          discountType && discountValue != null && discountValue > 0
            ? { type: discountType, value: discountValue }
            : null,
        items: items.map((item, idx) => ({
          id: item.id,
          description: item.description,
          amount: Number(item.amount || 0),
          position: idx,
        })),
      };
      const result = await saveQuoteAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['quote', newId] });
      queryClient.invalidateQueries({ queryKey: ['quote-items', newId] });
      queryClient.invalidateQueries({ queryKey: ['all-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] });
      toast('Quote saved');
      setDirty(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not save the quote', 'error'),
  });

  const sendEmail = useMutation({
    mutationFn: async () => {
      // Save first if dirty / new, so the public page has the latest.
      let targetId = effectiveId;
      if (dirty || !targetId) {
        targetId = await save.mutateAsync();
      }
      if (!targetId) throw new Error('No quote to send');

      const res = await fetch('/api/email/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      return targetId;
    },
    onSuccess: (id) => {
      toast('Sent to couple');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['all-quotes'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to send', 'error'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const result = await deleteQuoteAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['couple-quotes'] });
      toast('Quote deleted');
      setConfirmingDelete(false);
      onDelete?.();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not delete the quote', 'error');
      setConfirmingDelete(false);
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user || !quote) throw new Error('Not authenticated');
      const { data: numData } = await supabase.rpc('generate_invoice_number', {
        p_user_id: user.user.id,
      });
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const dueStr = dueDate.toISOString().split('T')[0]!;
      const { data: inv, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.user.id,
          couple_id: quote.couple_id,
          quote_id: quote.id,
          invoice_number: numData as string,
          title: quote.title,
          status: 'draft',
          subtotal: quote.subtotal,
          due_date: dueStr,
          notes: quote.notes,
        })
        .select('id')
        .single();
      if (error || !inv) throw error;
      if (items.length > 0) {
        await supabase.from('invoice_items').insert(
          items.map((item, idx) => ({
            invoice_id: inv.id,
            user_id: user.user!.id,
            description: item.description,
            quantity: 1,
            unit_price: item.amount,
            amount: item.amount,
            position: (idx + 1) * 1000,
          })),
        );
      }
      return inv.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      onCreateInvoice?.(id);
    },
    onError: () => toast('Failed to create invoice', 'error'),
  });

  /* ─── handlers ──────────────────────────────────────────────── */

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: `new-${crypto.randomUUID()}`, description: '', amount: 0, position: prev.length },
    ]);
    setDirty(true);
  }

  function updateItem(id: string, field: 'description' | 'amount', value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
    setDirty(true);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setDirty(true);
  }

  function reorderItems(next: LineItem[]) {
    setItems(next);
    setDirty(true);
  }

  function applyTemplate(templateId: string) {
    const tpl = templates?.templates.find((t) => t.id === templateId);
    const tplItems = templates?.items[templateId] ?? [];
    if (!tpl) return;
    setItems(
      tplItems.map((item, idx) => ({
        id: `new-${crypto.randomUUID()}`,
        description: item.description,
        amount: item.amount,
        position: idx,
      })),
    );
    if (tpl.notes && !notes) setNotes(tpl.notes);
    setDirty(true);
  }

  /* ─── chrome / shell wiring ─────────────────────────────────── */

  const pillKey = (status in STATE_PILL ? status : 'draft') as keyof typeof STATE_PILL;
  const documentNumber = quote?.quote_number ?? 'Quote';

  const overflowItems: OverflowMenuItem[] = [];
  if (status === 'accepted') {
    overflowItems.push({
      label: 'Convert to invoice',
      onClick: () => convertToInvoice.mutate(),
    });
  }
  if (effectiveId && canEdit) {
    overflowItems.push({
      label: 'Delete quote',
      danger: true,
      onClick: () => setConfirmingDelete(true),
    });
  }

  // No contextual primary CTA on quotes — the Send button in the
  // footer is the main action.
  const primaryAction: BuilderModalPrimaryAction | undefined = undefined;

  const templateOptions: QuoteTemplate[] = (templates?.templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    notes: t.notes,
    itemCount: templates?.items[t.id]?.length ?? 0,
  }));

  // Live preview doc — re-derived on every render from the local
  // form state so the right pane updates without a save round-trip.
  const previewDoc: PreviewDoc = {
    kind: 'quote',
    documentNumber: quote?.quote_number ?? 'DRAFT',
    title: title || 'Wedding Quote',
    status,
    coupleName,
    businessName: null, // hydrated by the preview pane itself from user_metadata
    items: items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: Number(item.amount || 0),
    })),
    taxRate: taxEnabled ? 10 : 0,
    discount:
      discountType && discountValue != null && discountValue > 0
        ? { type: discountType, value: discountValue }
        : null,
    notes: notes || null,
    expiresAt: expiresAt,
    shareUrl: shareUrl ?? `https://example.com/quote/${quote?.share_token ?? 'preview'}`,
  };

  return (
    <>
      <BuilderModalShell
        isOpen={isOpen}
        onClose={onClose}
        documentNumber={documentNumber}
        statePill={STATE_PILL[pillKey]}
        primaryAction={primaryAction}
        overflowItems={overflowItems}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        titlePlaceholder={
          coupleName ? `Quote for ${coupleName}` : 'Wedding quote title'
        }
        titleReadOnly={!canEdit}
        previewPane={
          <BuilderPreviewPane
            doc={previewDoc}
            surface="quote"
            collapsed={previewCollapsed}
            onToggleCollapsed={setPreviewCollapsed}
          />
        }
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={shareEnabled}
            shareUrl={shareUrl}
            lastSentAt={quote?.email_sent_at ?? null}
            locked={!canEdit}
            saving={save.isPending}
            sending={sendEmail.isPending}
            hasCouple={!!coupleId}
            onSave={() => save.mutate()}
            onSend={() => sendEmail.mutate()}
          />
        }
      >
        {/* Meta row — couple + expiry */}
        <BuilderMetaRow
          selectedCoupleId={coupleId}
          selectedCoupleName={coupleName}
          coupleOptions={couples ?? []}
          canEditCouple={canEdit}
          onSelectCouple={(c) => {
            setCoupleId(c.id);
            setCoupleName(c.name);
            setDirty(true);
          }}
          dateValue={expiresAt}
          dateLabel="Expiry"
          onDateChange={(d) => {
            setExpiresAt(d);
            setDirty(true);
          }}
          canEdit={canEdit}
        />

        {/* Items — with empty-state template picker */}
        <div className="mt-6">
          <LineItemsTable
            items={items}
            canEdit={canEdit}
            onUpdate={updateItem}
            onRemove={removeItem}
            onReorder={reorderItems}
            onAdd={addItem}
            headerAccessory={
              items.length === 0 && canEdit ? (
                <TemplatePicker
                  variant="empty-state"
                  templates={templateOptions}
                  canApply={canEdit}
                  onApply={applyTemplate}
                />
              ) : items.length > 0 && canEdit && templateOptions.length > 0 ? (
                <div className="flex justify-end">
                  <TemplatePicker
                    variant="inline"
                    templates={templateOptions}
                    canApply={canEdit}
                    onApply={applyTemplate}
                  />
                </div>
              ) : null
            }
          />
        </div>

        {/* Discount + Tax + Totals row */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <DiscountControl
              type={discountType}
              value={discountValue}
              canEdit={canEdit}
              onAdd={() => {
                setDiscountType('percentage');
                setDiscountValue(10);
                setDirty(true);
              }}
              onRemove={() => {
                setDiscountType(null);
                setDiscountValue(null);
                setDirty(true);
              }}
              onTypeChange={(t) => {
                setDiscountType(t);
                setDirty(true);
              }}
              onValueChange={(v) => {
                setDiscountValue(v);
                setDirty(true);
              }}
            />
            <TaxControl
              applied={taxEnabled}
              canEdit={canEdit}
              onApply={() => {
                setTaxEnabled(true);
                setDirty(true);
              }}
              onRemove={() => {
                setTaxEnabled(false);
                setDirty(true);
              }}
            />
          </div>
          <div className="sm:max-w-xs sm:w-full">
            <TotalsPanel
              subtotal={subtotal}
              discount={discountAmount > 0 ? discountAmount : undefined}
              tax={tax > 0 ? tax : undefined}
              total={total}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <NotesField
            value={notes}
            onChange={(v) => {
              setNotes(v);
              setDirty(true);
            }}
            canEdit={canEdit}
            label="Notes & terms"
            placeholder="Anything you want the couple to see — payment terms, what's included, etc."
          />
        </div>
      </BuilderModalShell>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this quote?"
        description="The quote and all its line items will be removed. This can't be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
