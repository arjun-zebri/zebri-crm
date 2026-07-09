/**
 * Server actions for the Quote + Invoice builder modals.
 *
 * Lifts the previously-inline `supabase.from('quotes').update(...)` /
 * `.insert(...)` / `.delete(...)` calls out of the modal components
 * so the modals are pure composition + presentation. Every action:
 *
 * - **Zod-validates** the input on the server (clients can't be
 *   trusted to send the right shape).
 * - **RLS-scoped** Supabase client (the user is the authenticated
 *   session; we never escape to the service-role key here).
 * - Returns a tagged `{ ok: true, data } | { ok: false, error }`
 *   result the modal can pattern-match on.
 *
 * For `saveInvoiceAction`, line items are persisted with
 * `quantity = 1, unit_price = amount` — the Phase 2C.2 UI removes
 * the quantity field, but the `invoice_items` schema keeps those
 * columns until a Phase 9 follow-up drops them. New writes default
 * them so the public RPC + PDF generator keep working.
 *
 * No rate-limit on these actions — they're authenticated, single-
 * user, and the modal isn't a public abuse vector. The send-email
 * routes (`/api/email/send-{quote,invoice}`) already carry the
 * 5/min/user limit from Phase 2C.
 *
 * @module app/(dashboard)/payments/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Shared shapes ────────────────────────────────────────────── */

const lineItemSchema = z.object({
  /** Existing rows carry the DB UUID; new rows use a "new-{uuid}"
   *  client-side sentinel that the action drops before insert. */
  id: z.string(),
  description: z.string().max(500),
  amount: z.number().min(0),
  position: z.number().int(),
});

const discountSchema = z.object({
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0),
});

/* ─── saveQuoteAction ──────────────────────────────────────────── */

const saveQuoteSchema = z.object({
  /** Null on first save of a new draft; uuid afterwards. */
  quoteId: z.uuid().nullable(),
  coupleId: z.uuid(),
  title: z.string().max(200),
  notes: z.string().max(5000).nullable(),
  expiresAt: z.string().nullable(),
  /** 0 (no GST) or 10 (GST applied). */
  taxRate: z.number(),
  discount: discountSchema.nullable(),
  /** Provenance: the package applied to start this quote (conversion
   *  stats). Items are still snapshotted; this never feeds rendering.
   *  Nullish so an older client bundle omitting it still validates. */
  sourcePackageId: z.uuid().nullish(),
  items: z.array(lineItemSchema),
});

export type SaveQuoteInput = z.infer<typeof saveQuoteSchema>;

export async function saveQuoteAction(
  input: SaveQuoteInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid quote data.' };
  }
  const { quoteId, coupleId, title, notes, expiresAt, taxRate, discount, sourcePackageId, items } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  try {
    let effectiveId = quoteId;

    if (effectiveId) {
      // Existing quote: UPDATE.
      const { error } = await supabase
        .from('quotes')
        .update({
          couple_id: coupleId,
          title,
          notes,
          expires_at: expiresAt,
          subtotal,
          tax_rate: taxRate,
          discount_type: discount?.type ?? null,
          discount_value: discount?.value ?? null,
          // Written only when the client sent the field, so an older
          // bundle mid-deploy can't blank existing provenance.
          ...(sourcePackageId !== undefined ? { source_package_id: sourcePackageId } : {}),
        })
        .eq('id', effectiveId);
      if (error) throw error;
    } else {
      // New quote: generate a quote_number then INSERT.
      const { data: numData, error: numErr } = await supabase.rpc('generate_quote_number', {
        p_user_id: user.id,
      });
      if (numErr) throw numErr;
      const quoteNumber = numData as string;
      const { data: inserted, error: qErr } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          couple_id: coupleId,
          title,
          quote_number: quoteNumber,
          status: 'draft',
          notes,
          expires_at: expiresAt,
          subtotal,
          tax_rate: taxRate,
          discount_type: discount?.type ?? null,
          discount_value: discount?.value ?? null,
          source_package_id: sourcePackageId ?? null,
        })
        .select('id')
        .single();
      if (qErr || !inserted) throw qErr ?? new Error('quote insert returned no row');
      effectiveId = inserted.id;
    }

    // Replace line items. Wipe then re-insert keeps the parent's
    // dnd ordering as the source of truth without resolving deltas.
    await supabase.from('quote_items').delete().eq('quote_id', effectiveId);
    if (items.length > 0) {
      const inserts = items.map((item, idx) => ({
        ...(item.id.startsWith('new-') ? {} : { id: item.id }),
        quote_id: effectiveId,
        user_id: user.id,
        description: item.description,
        amount: item.amount,
        position: (idx + 1) * 1000,
      }));
      const { error: iErr } = await supabase.from('quote_items').insert(inserts);
      if (iErr) throw iErr;
    }

    return { ok: true, data: { id: effectiveId } };
  } catch (err) {
    logger.error('[payments/actions] saveQuoteAction failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the quote. Please try again.' };
  }
}

/* ─── saveInvoiceAction ────────────────────────────────────────── */

const saveInvoiceSchema = z.object({
  invoiceId: z.uuid().nullable(),
  coupleId: z.uuid(),
  eventId: z.uuid().nullable(),
  title: z.string().max(200),
  notes: z.string().max(5000).nullable(),
  paymentTerms: z.string().nullable(),
  dueDate: z.string().nullable(),
  taxRate: z.number(),
  discount: discountSchema.nullable(),
  depositPercent: z.number().int().min(1).max(99).nullable(),
  depositDueDate: z.string().nullable(),
  finalDueDate: z.string().nullable(),
  stripePaymentEnabled: z.boolean(),
  items: z.array(lineItemSchema),
});

export type SaveInvoiceInput = z.infer<typeof saveInvoiceSchema>;

export async function saveInvoiceAction(
  input: SaveInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid invoice data.' };
  }
  const {
    invoiceId,
    coupleId,
    eventId,
    title,
    notes,
    paymentTerms,
    dueDate,
    taxRate,
    discount,
    depositPercent,
    depositDueDate,
    finalDueDate,
    stripePaymentEnabled,
    items,
  } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  try {
    let effectiveId = invoiceId;

    const fields = {
      couple_id: coupleId,
      event_id: eventId,
      title,
      notes,
      payment_terms: paymentTerms,
      due_date: dueDate,
      subtotal,
      tax_rate: taxRate,
      discount_type: discount?.type ?? null,
      discount_value: discount?.value ?? null,
      deposit_percent: depositPercent,
      deposit_due_date: depositDueDate,
      final_due_date: finalDueDate,
      stripe_payment_enabled: stripePaymentEnabled,
    };

    if (effectiveId) {
      const { error } = await supabase.from('invoices').update(fields).eq('id', effectiveId);
      if (error) throw error;
    } else {
      const { data: numData, error: numErr } = await supabase.rpc('generate_invoice_number', {
        p_user_id: user.id,
      });
      if (numErr) throw numErr;
      const invoiceNumber = numData as string;
      const { data: inserted, error: insErr } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          status: 'draft',
          invoice_number: invoiceNumber,
          ...fields,
        })
        .select('id')
        .single();
      if (insErr || !inserted) throw insErr ?? new Error('invoice insert returned no row');
      effectiveId = inserted.id;
    }

    // Replace line items. Forward-compat with the existing
    // `invoice_items.quantity` + `unit_price` columns by writing
    // `quantity = 1, unit_price = amount` — the new Phase 2C.2 UI
    // doesn't expose qty editing.
    await supabase.from('invoice_items').delete().eq('invoice_id', effectiveId);
    if (items.length > 0) {
      const inserts = items.map((item, idx) => ({
        ...(item.id.startsWith('new-') ? {} : { id: item.id }),
        invoice_id: effectiveId,
        user_id: user.id,
        description: item.description,
        quantity: 1,
        unit_price: item.amount,
        amount: item.amount,
        position: (idx + 1) * 1000,
      }));
      const { error: iErr } = await supabase.from('invoice_items').insert(inserts);
      if (iErr) throw iErr;
    }

    return { ok: true, data: { id: effectiveId } };
  } catch (err) {
    logger.error('[payments/actions] saveInvoiceAction failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the invoice. Please try again.' };
  }
}

/* ─── deleteQuoteAction ────────────────────────────────────────── */

export async function deleteQuoteAction(quoteId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(quoteId);
  if (!parsed.success) return { ok: false, error: 'Invalid quote ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    // RLS filters this to the authenticated user's rows; cascade
    // handles quote_items.
    const { error } = await supabase.from('quotes').delete().eq('id', parsed.data);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error('[payments/actions] deleteQuoteAction failed', {
      userId: user.id,
      quoteId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not delete the quote.' };
  }
}

/* ─── deleteInvoiceAction ──────────────────────────────────────── */

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: 'Invalid invoice ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { error } = await supabase.from('invoices').delete().eq('id', parsed.data);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error('[payments/actions] deleteInvoiceAction failed', {
      userId: user.id,
      invoiceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not delete the invoice.' };
  }
}

/* ─── saveContractAction ────────────────────────────────────────
   The contract `content` field is a TipTap JSON document — a
   nested tree of nodes/marks with no fixed shape we want to pin
   here (changes whenever a node type is added/removed in the
   editor). We accept it as an unknown record + trust the editor
   to produce a valid tree; downstream `renderContractHtml` is
   the integrity gate. ─────────────────────────────────────── */

const saveContractSchema = z.object({
  contractId: z.uuid(),
  title: z.string().max(200),
  content: z.record(z.string(), z.unknown()),
  expiresAt: z.string().nullable(),
  quoteId: z.uuid().nullable(),
});

export type SaveContractInput = z.infer<typeof saveContractSchema>;

export async function saveContractAction(
  input: SaveContractInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveContractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contract data.' };
  }
  const { contractId, title, content, expiresAt, quoteId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { error } = await supabase
      .from('contracts')
      .update({
        title: title || 'Untitled contract',
        // content is a TipTap JSONContent tree — opaque to us; the
        // generated Database type narrows the column to `Json`,
        // so we cast at the boundary. The Zod schema already
        // proved this is a record shape.
        content: content as unknown as Json,
        expires_at: expiresAt,
        quote_id: quoteId,
      })
      .eq('id', contractId);
    if (error) throw error;
    return { ok: true, data: { id: contractId } };
  } catch (err) {
    logger.error('[payments/actions] saveContractAction failed', {
      userId: user.id,
      contractId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the contract.' };
  }
}

/* ─── revokeContractAction ─────────────────────────────────────
   Wraps the `revoke_contract(p_contract_id)` SECURITY INVOKER
   RPC. The DB-side logic resets status → draft, regenerates the
   share token, clears the locked content snapshot, and bumps
   `version` — RLS scopes the call to the authenticated user's
   own row.

   Phase 3.2 will additionally write a `revoked` row into the
   forthcoming `contract_audit_log` table BEFORE the RPC clears
   the inline `signed_at` / `signer_*` columns, so the prior
   signing trail survives revocation. ───────────────────────── */

export async function revokeContractAction(
  contractId: string,
): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(contractId);
  if (!parsed.success) return { ok: false, error: 'Invalid contract ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { error } = await supabase.rpc('revoke_contract', {
      p_contract_id: parsed.data,
    });
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error('[payments/actions] revokeContractAction failed', {
      userId: user.id,
      contractId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not revoke the contract.' };
  }
}

/* ─── deleteContractAction ────────────────────────────────────── */

export async function deleteContractAction(
  contractId: string,
): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(contractId);
  if (!parsed.success) return { ok: false, error: 'Invalid contract ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { error } = await supabase.from('contracts').delete().eq('id', parsed.data);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error('[payments/actions] deleteContractAction failed', {
      userId: user.id,
      contractId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not delete the contract.' };
  }
}
