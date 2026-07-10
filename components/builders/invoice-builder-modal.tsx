/**
 * Invoice builder modal.
 *
 * Composition over the new `components/builders/parts/*` set, plus
 * the invoice-only pieces: payment schedule timeline, payment terms,
 * status-aware contextual header CTA, and the Stripe card-payments
 * toggle.
 *
 * Status machine surfaced on the header:
 * - `draft` → no contextual CTA (Send button in the footer is the
 *   primary action).
 * - `sent` (no schedule) → "Mark paid" CTA.
 * - `sent` (with deposit schedule) → "Mark deposit paid" CTA.
 * - `deposit_paid` → "Mark final paid" CTA.
 * - `paid` → no CTA (status pill only).
 * - `overdue` → "Mark paid" (danger-toned).
 * - `cancelled` → no CTA.
 *
 * Overflow menu:
 * - "Revert to sent" — when paid.
 * - "Cancel invoice" — when editable.
 * - "Delete invoice" — always.
 *
 * Saves flow through `saveInvoiceAction` (server action with Zod +
 * RLS). Mark-paid / revert / cancel mutations stay inline (one-line
 * status updates that don't justify their own server actions).
 *
 * @module components/builders/invoice-builder-modal
 */
'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  deleteInvoiceAction,
  saveInvoiceAction,
  type SaveInvoiceInput,
} from '@/app/(dashboard)/payments/actions';
import { AddOnPickerDialog } from '@/components/builders/parts/add-on-picker-dialog';
import { BuilderMetaRow, type PaymentTerms } from '@/components/builders/parts/builder-meta-row';
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
import { PaymentSchedule } from '@/components/builders/parts/payment-schedule';
import type { PreviewDoc } from '@/components/builders/parts/preview-shared';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { TaxControl } from '@/components/builders/parts/tax-control';
import { TemplatePicker } from '@/components/builders/parts/template-picker';
import { TotalsPanel } from '@/components/builders/parts/totals-panel';
import {
  useApplySources,
  type ApplyItem,
  type ApplySource,
} from '@/components/builders/parts/use-apply-sources';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StatePillProps } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import { stripeConnectEnabled } from '@/lib/auth/entitlements';
import { weekendLoadingLine } from '@/lib/payments/package-math';
import { createClient } from '@/lib/supabase/client';
import { isPastDue } from '@/lib/utils';

interface Invoice {
  id: string;
  title: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  notes: string | null;
  due_date: string | null;
  payment_terms: string | null;
  tax_rate: number | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  deposit_percent: number | null;
  deposit_due_date: string | null;
  deposit_paid_at: string | null;
  final_due_date: string | null;
  final_paid_at: string | null;
  paid_at: string | null;
  stripe_payment_enabled: boolean;
  share_token: string;
  share_token_enabled: boolean;
  email_sent_at: string | null;
  couple_id: string;
  couple_name: string;
  event_id: string | null;
  /** Provenance: the accepted proposal this invoice was generated
   *  from, if any. Never feeds rendering. */
  proposal_id?: string | null;
}

export interface InvoiceBuilderModalProps {
  invoiceId: string | null;
  initialCoupleId?: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

const STATE_PILL: Record<string, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  deposit_paid: { label: 'Deposit paid', tone: 'warning', dot: 'filled' },
  paid: { label: 'Paid', tone: 'success', dot: 'filled' },
  overdue: { label: 'Overdue', tone: 'danger', dot: 'hollow' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

export function InvoiceBuilderModal({
  invoiceId,
  initialCoupleId,
  isOpen,
  onClose,
  onDelete,
}: InvoiceBuilderModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isNewInvoice = invoiceId === 'new' || invoiceId === null;
  const effectiveId = isNewInvoice ? null : invoiceId;

  /* ─── form state ────────────────────────────────────────────── */
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState<string | null>(null);
  const [eventId] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState(50);
  const [depositDueDate, setDepositDueDate] = useState('');
  const [finalDueDate, setFinalDueDate] = useState('');
  const [stripePaymentEnabled, setStripePaymentEnabled] = useState(false);
  const [stripeConnectOn, setStripeConnectOn] = useState(false);
  // A picked package whose add-ons still need choosing before apply.
  const [pendingApply, setPendingApply] = useState<{ name: string; source: ApplySource } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Auto-animate refs for the totals area + chip container, and
  // the payment-schedule slot so add / remove glides.
  const [chipsRef] = useAutoAnimate<HTMLDivElement>();
  const [totalsAreaRef] = useAutoAnimate<HTMLDivElement>();
  const [scheduleSlotRef] = useAutoAnimate<HTMLDivElement>();

  /* ─── data ──────────────────────────────────────────────────── */
  const { data: invoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoice', effectiveId],
    enabled: !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, couple:couple_id(name)')
        .eq('id', effectiveId!)
        .single();
      if (error) throw error;
      const couple = (data.couple as { name: string } | null) ?? null;
      return { ...data, couple_name: couple?.name ?? '' } as Invoice;
    },
  });

  const { data: dbItems } = useQuery({
    queryKey: ['invoice-items', effectiveId],
    enabled: !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('id, description, amount, position')
        .eq('invoice_id', effectiveId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as LineItem[]) ?? [];
    },
  });

  // Invoice templates + quote templates + packages, offered as
  // "start from" sources (invoice templates are invoice-builder only).
  const { data: applySources } = useApplySources({
    includeInvoiceTemplates: true,
    includeAcceptedProposals: true,
  });

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-invoice'],
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

  /* ─── derived effective status (handles overdue) ───────────── */
  const rawStatus = invoice?.status ?? 'draft';
  const isOverdue = rawStatus === 'sent' && isPastDue(dueDate);
  const status = isOverdue ? 'overdue' : rawStatus;
  const canEdit = !['paid', 'cancelled'].includes(rawStatus);
  const templateOptions = applySources?.options ?? [];
  const hasDepositSchedule = depositEnabled && !!depositDueDate;
  const shareEnabled = invoice?.share_token_enabled ?? false;
  const shareUrl =
    typeof window !== 'undefined' && invoice?.share_token
      ? `${window.location.origin}/invoice/${invoice.share_token}`
      : null;

  /* ─── hydrate from DB / initial defaults ────────────────────── */
  useEffect(() => {
    async function loadStripeConnect() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setStripeConnectOn(stripeConnectEnabled(user));
    }
    void loadStripeConnect();
  }, [supabase, isOpen]);

  useEffect(() => {
    if (isNewInvoice) {
      setTitle('');
      setNotes('');
      setDueDate(null);
      setPaymentTerms('');
      setItems([]);
      setCoupleId(initialCoupleId ?? null);
      setCoupleName(
        initialCoupleId ? couples?.find((c) => c.id === initialCoupleId)?.name ?? null : null,
      );
      setTaxRate(null);
      setDiscountType(null);
      setDiscountValue(null);
      setDepositEnabled(false);
      setDepositPercent(50);
      setDepositDueDate('');
      setFinalDueDate('');
      setStripePaymentEnabled(false);
      setProposalId(null);
      setDirty(false);
      return;
    }
    if (invoice) {
      setTitle(invoice.title);
      setNotes(invoice.notes ?? '');
      setDueDate(invoice.due_date);
      setPaymentTerms((invoice.payment_terms ?? '') as PaymentTerms);
      setCoupleId(invoice.couple_id);
      setCoupleName(invoice.couple_name);
      setTaxRate(invoice.tax_rate != null && invoice.tax_rate > 0 ? invoice.tax_rate : null);
      setDiscountType(invoice.discount_type);
      setDiscountValue(invoice.discount_value);
      // The schedule is "enabled" if we have the percent + due dates
      // stored, OR if a payment has actually been recorded against
      // it (covers the case where mark-paid fired before the schedule
      // was persisted via Save changes — see the auto-save in
      // markDepositPaid/markFinalPaid below).
      const hasSched =
        (invoice.deposit_percent != null && invoice.deposit_due_date != null) ||
        invoice.deposit_paid_at != null ||
        invoice.final_paid_at != null;
      setDepositEnabled(hasSched);
      setDepositPercent(invoice.deposit_percent ?? 50);
      setDepositDueDate(invoice.deposit_due_date ?? '');
      setFinalDueDate(invoice.final_due_date ?? '');
      setStripePaymentEnabled(invoice.stripe_payment_enabled);
      setProposalId(invoice.proposal_id ?? null);
      setDirty(false);
    }
  }, [invoice?.id, isNewInvoice, initialCoupleId, couples]);

  useEffect(() => {
    if (dbItems) setItems(dbItems);
  }, [dbItems]);

  /* ─── computed money ────────────────────────────────────────── */
  const subtotal = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const discountAmount =
    discountType && discountValue != null && discountValue > 0
      ? discountType === 'percentage'
        ? (subtotal * discountValue) / 100
        : discountValue
      : 0;
  const taxableAmount = subtotal - discountAmount;
  const effectiveTaxRate = taxRate ?? 0;
  const tax = taxableAmount * (effectiveTaxRate / 100);
  const total = taxableAmount + tax;
  const depositAmount = total * (depositPercent / 100);
  const finalAmount = total - depositAmount;

  /* ─── handlers ──────────────────────────────────────────────── */

  function setPaymentTermsAndDate(next: PaymentTerms) {
    setPaymentTerms(next);
    setDirty(true);
    if (next === 'net_7') setDueDate(addDays(7));
    else if (next === 'net_14') setDueDate(addDays(14));
    else if (next === 'net_30') setDueDate(addDays(30));
    else if (next === 'due_on_receipt') setDueDate(null);
    // 'custom' and '' leave dueDate as-is
  }

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

  // Apply a saved set of line items (a quote template or a package).
  function applyTemplate(sourceId: string) {
    const source = applySources?.applyMap[sourceId];
    if (!source) return;
    // A package with add-ons needs the "which extras?" step first.
    if (source.addOns.length > 0) {
      const name = applySources?.options.find((o) => o.id === sourceId)?.name ?? 'This package';
      setPendingApply({ name, source });
      return;
    }
    commitApply(source, []);
  }

  function commitApply(source: ApplySource, chosenAddOns: ApplyItem[]) {
    const lines = [...source.items, ...chosenAddOns];
    // Peak-rate packages append a transparent loading line the MC
    // deletes for an off-peak date.
    const loading = weekendLoadingLine(
      lines.reduce((sum, i) => sum + i.amount, 0),
      source.package?.weekendLoadingPercent,
    );
    setItems(
      [...lines, ...(loading ? [loading] : [])].map((item, idx) => ({
        id: `new-${crypto.randomUUID()}`,
        description: item.description,
        amount: item.amount,
        position: idx,
      })),
    );
    if (source.notes && !notes) setNotes(source.notes);
    if (source.package) {
      // GST-inclusive prices already carry the tax; adding 10% on top
      // would misquote. Exclusive packages keep GST on top.
      setTaxRate(source.package.gstInclusive ? null : 10);
      // The package's booking-deposit rule pre-fills the payment
      // schedule; due dates stay the MC's call.
      if (source.package.depositPercent != null) {
        setDepositEnabled(true);
        setDepositPercent(source.package.depositPercent);
      }
    }
    if (source.proposal) {
      // Invoicing what the couple agreed to: the accepted option's
      // terms carry over, and the invoice records its provenance.
      setTaxRate(source.proposal.gstInclusive ? null : 10);
      if (source.proposal.depositPercent != null) {
        setDepositEnabled(true);
        setDepositPercent(source.proposal.depositPercent);
      }
      setProposalId(source.proposal.id);
    } else {
      setProposalId(null);
    }
    setPendingApply(null);
    setDirty(true);
  }

  /* ─── mutations ─────────────────────────────────────────────── */

  const save = useMutation({
    mutationFn: async () => {
      if (!coupleId) throw new Error('Please select a couple first');
      const input: SaveInvoiceInput = {
        invoiceId: effectiveId,
        coupleId,
        eventId,
        title,
        notes: notes || null,
        paymentTerms: paymentTerms || null,
        dueDate,
        taxRate: effectiveTaxRate,
        discount:
          discountType && discountValue != null && discountValue > 0
            ? { type: discountType, value: discountValue }
            : null,
        depositPercent: depositEnabled ? depositPercent : null,
        depositDueDate: depositEnabled ? depositDueDate || null : null,
        finalDueDate: depositEnabled ? finalDueDate || null : null,
        stripePaymentEnabled,
        proposalId,
        items: items.map((item, idx) => ({
          id: item.id,
          description: item.description,
          amount: Number(item.amount || 0),
          position: idx,
        })),
      };
      const result = await saveInvoiceAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', newId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-items', newId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] });
      toast('Invoice saved');
      setDirty(false);
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Could not save the invoice', 'error'),
  });

  const sendEmail = useMutation({
    mutationFn: async () => {
      let targetId = effectiveId;
      if (dirty || !targetId) {
        targetId = await save.mutateAsync();
      }
      if (!targetId) throw new Error('No invoice to send');
      const res = await fetch('/api/email/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      return targetId;
    },
    onSuccess: (id) => {
      toast('Sent to couple');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to send', 'error'),
  });

  // Status mutations stay inline — one-line UPDATEs not worth a
  // dedicated server action each. RLS scopes them to the user.
  // Each mark mutation auto-saves pending form edits first so the
  // schedule (or any other dirty field) is persisted before the
  // status flips — otherwise refresh would lose, e.g., the schedule
  // fields and the UI would re-hydrate with depositEnabled=false.
  async function ensureSaved(): Promise<string> {
    if (dirty || !effectiveId) {
      return await save.mutateAsync();
    }
    return effectiveId;
  }

  // Mark sent WITHOUT emailing — for when the MC shared the link
  // out-of-band (copied it, texted it). Flips draft→sent and makes
  // sure the public link is live; deliberately leaves `email_sent_at`
  // null (no email went out), so the footer still offers "Send to
  // couple" if they later want the templated email too.
  const markSent = useMutation({
    mutationFn: async () => {
      const id = await ensureSaved();
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', share_token_enabled: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] });
      toast('Marked as sent');
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Failed to mark as sent', 'error'),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      const id = await ensureSaved();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: now, final_paid_at: hasDepositSchedule ? now : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      toast('Marked as paid');
    },
    onError: () => toast('Failed to mark as paid', 'error'),
  });

  const markDepositPaid = useMutation({
    mutationFn: async () => {
      const id = await ensureSaved();
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'deposit_paid', deposit_paid_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      toast('Deposit marked as paid');
    },
    onError: () => toast('Failed to mark deposit as paid', 'error'),
  });

  const markFinalPaid = useMutation({
    mutationFn: async () => {
      const id = await ensureSaved();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: now, final_paid_at: now })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      toast('Final payment marked as paid');
    },
    onError: () => toast('Failed to mark final payment as paid', 'error'),
  });

  const revertPaid = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', paid_at: null, final_paid_at: null })
        .eq('id', effectiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      toast('Reverted to sent');
    },
    onError: () => toast('Failed to revert', 'error'),
  });

  const cancelInvoice = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled', share_token_enabled: false })
        .eq('id', effectiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      toast('Invoice cancelled');
      setConfirmCancel(false);
    },
    onError: () => {
      toast('Failed to cancel invoice', 'error');
      setConfirmCancel(false);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const result = await deleteInvoiceAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['couple-invoices'] });
      toast('Invoice deleted');
      setConfirmDelete(false);
      onDelete?.();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not delete the invoice', 'error');
      setConfirmDelete(false);
    },
  });

  /* ─── shell wiring ──────────────────────────────────────────── */

  const pillKey = (status in STATE_PILL ? status : 'draft') as keyof typeof STATE_PILL;
  const documentNumber = invoice?.invoice_number ?? 'Invoice';

  // Status-aware contextual CTA in the header.
  let primaryAction: BuilderModalPrimaryAction | undefined;
  // All "mark paid" actions render in the success variant (lime) —
  // they're affirmative state transitions, not destructive ones, so
  // even an overdue invoice gets a success-toned CTA. The status
  // pill alone communicates the overdue state.
  if (rawStatus === 'sent' && hasDepositSchedule) {
    primaryAction = {
      label: 'Mark deposit paid',
      onClick: () => markDepositPaid.mutate(),
      loading: markDepositPaid.isPending,
      variant: 'success',
    };
  } else if (rawStatus === 'deposit_paid') {
    primaryAction = {
      label: 'Mark final paid',
      onClick: () => markFinalPaid.mutate(),
      loading: markFinalPaid.isPending,
      variant: 'success',
    };
  } else if (rawStatus === 'sent' || isOverdue) {
    primaryAction = {
      label: 'Mark paid',
      onClick: () => markPaid.mutate(),
      loading: markPaid.isPending,
      variant: 'success',
    };
  }

  // Overflow menu — destructive + revert actions.
  const overflowItems: OverflowMenuItem[] = [];
  if (rawStatus === 'paid') {
    overflowItems.push({
      label: 'Revert to sent',
      onClick: () => revertPaid.mutate(),
    });
  }
  if (canEdit && effectiveId) {
    overflowItems.push({
      label: 'Cancel invoice',
      danger: true,
      onClick: () => setConfirmCancel(true),
    });
  }
  // Delete is surfaced as a dedicated trash icon (passed via
  // `onDelete` below), not as a menu item.

  // Live preview doc — fed to the right pane on every render so the
  // PDF / Email / Payment-page previews track form edits without a
  // save round-trip.
  const previewDoc: PreviewDoc = {
    kind: 'invoice',
    documentNumber: invoice?.invoice_number ?? 'DRAFT',
    title: title || 'Wedding Invoice',
    status,
    coupleName,
    businessName: null,
    items: items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: Number(item.amount || 0),
    })),
    taxRate: effectiveTaxRate,
    discount:
      discountType && discountValue != null && discountValue > 0
        ? { type: discountType, value: discountValue }
        : null,
    notes: notes || null,
    dueDate: dueDate,
    shareUrl: shareUrl ?? `https://example.com/invoice/${invoice?.share_token ?? 'preview'}`,
    stripePaymentEnabled,
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
        {...(effectiveId ? { onDelete: () => setConfirmDelete(true), deleteLabel: 'Delete invoice' } : {})}
        loading={!!effectiveId && invoiceLoading && !invoice}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        titlePlaceholder={coupleName ? `Invoice for ${coupleName}` : 'Wedding invoice title'}
        titleReadOnly={!canEdit}
        previewPane={<BuilderPreviewPane doc={previewDoc} surface="invoice" />}
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={shareEnabled}
            shareUrl={shareUrl}
            lastSentAt={invoice?.email_sent_at ?? null}
            locked={!canEdit}
            saving={save.isPending}
            sending={sendEmail.isPending}
            hasCouple={!!coupleId}
            onSave={() => save.mutate()}
            onSend={() => sendEmail.mutate()}
            canMarkSent={rawStatus === 'draft'}
            markingSent={markSent.isPending}
            onMarkSent={() => markSent.mutate()}
          />
        }
      >
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
          paymentTerms={paymentTerms}
          onPaymentTermsChange={setPaymentTermsAndDate}
          dateValue={dueDate}
          dateLabel="Set due date"
          datePrefix="Due"
          onDateChange={(d) => {
            setDueDate(d);
            setDirty(true);
          }}
          canEdit={canEdit}
        />

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

        {/* Totals area. Auto-animate refs so layout changes
            (discount expansion, GST line appearing) glide. */}
        <div ref={totalsAreaRef} className="mt-6 flex flex-col items-end gap-3">
          <div ref={chipsRef} className="flex flex-col items-end gap-2">
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
              rate={taxRate}
              canEdit={canEdit}
              onChange={(next) => {
                setTaxRate(next);
                setDirty(true);
              }}
            />
          </div>
          <TotalsPanel
            subtotal={subtotal}
            discount={discountAmount > 0 ? discountAmount : undefined}
            tax={tax > 0 ? tax : undefined}
            taxLabel={`GST ${Math.round(effectiveTaxRate)}%`}
            total={total}
          />
        </div>

        {/* Payment schedule — auto-animate swaps between the schedule
            timeline and the "+ Add payment schedule" affordance.
            Each branch is wrapped in a keyed div so auto-animate
            consistently sees a sibling add/remove on every toggle
            (without the wrappers, the second toggle skips the
            animation because the observer doesn't pick up the type
            change cleanly). */}
        <div ref={scheduleSlotRef} className="mt-8">
          {depositEnabled ? (
            <div key="schedule">
              <PaymentSchedule
                canEdit={canEdit}
                depositPercent={depositPercent}
                depositDueDate={depositDueDate}
                finalDueDate={finalDueDate}
                depositPaidAt={invoice?.deposit_paid_at ?? null}
                finalPaidAt={invoice?.final_paid_at ?? null}
                depositAmount={depositAmount}
                finalAmount={finalAmount}
                onDepositPercentChange={(v) => {
                  setDepositPercent(v);
                  setDirty(true);
                }}
                onDepositDueDateChange={(v) => {
                  setDepositDueDate(v);
                  setDirty(true);
                }}
                onFinalDueDateChange={(v) => {
                  setFinalDueDate(v);
                  setDirty(true);
                }}
                onMarkDepositPaid={() => markDepositPaid.mutate()}
                onMarkFinalPaid={() => markFinalPaid.mutate()}
                onRemove={() => {
                  setDepositEnabled(false);
                  setDepositDueDate('');
                  setFinalDueDate('');
                  setDirty(true);
                }}
                markDepositPending={markDepositPaid.isPending}
                markFinalPending={markFinalPaid.isPending}
              />
            </div>
          ) : canEdit ? (
            <button
              key="add-schedule"
              type="button"
              onClick={() => {
                setDepositEnabled(true);
                setDepositDueDate(addDays(0));
                setFinalDueDate(dueDate ?? addDays(60));
                setDirty(true);
              }}
              className="inline-flex items-center gap-1.5 text-body text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              + Add payment schedule
            </button>
          ) : null}
        </div>

        {/* Card payments toggle — only when Stripe Connect is on */}
        {stripeConnectOn && canEdit ? (
          <div className="mt-6 flex items-center justify-between rounded-card border border-border bg-surface px-3 py-2.5">
            <div>
              <p className="text-body text-text">Accept card payments</p>
              <p className="text-caption text-text-muted">
                Adds a Pay with card button on the public invoice page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStripePaymentEnabled((v) => !v);
                setDirty(true);
              }}
              role="switch"
              aria-checked={stripePaymentEnabled}
              className={`inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                stripePaymentEnabled ? 'bg-success' : 'bg-surface-emphasis border border-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform ${
                  stripePaymentEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          <NotesField
            value={notes}
            onChange={(v) => {
              setNotes(v);
              setDirty(true);
            }}
            canEdit={canEdit}
            label="Notes"
            placeholder="Bank details, payment terms, or any notes for the couple."
          />
        </div>
      </BuilderModalShell>

      {/* Add-on selection when applying a package with optional extras */}
      <AddOnPickerDialog
        open={!!pendingApply}
        packageName={pendingApply?.name ?? ''}
        addOns={pendingApply?.source.addOns ?? []}
        onApply={(chosen) => pendingApply && commitApply(pendingApply.source, chosen)}
        onCancel={() => setPendingApply(null)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this invoice?"
        description="The invoice will be marked as cancelled and its share link will stop working. This can't be undone."
        confirmLabel="Cancel invoice"
        loading={cancelInvoice.isPending}
        onConfirm={() => cancelInvoice.mutate()}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this invoice?"
        description="The invoice and all its line items will be removed. This can't be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

