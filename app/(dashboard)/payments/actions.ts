/**
 * Server actions for the Invoice and Contract builder modals.
 *
 * Lifts the previously-inline `supabase.from('invoices').update(...)` /
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
 * routes already carry the 5/min/user limit from Phase 2C.
 *
 * @module app/(dashboard)/payments/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { contractCoupleLimit } from '@/lib/payments/subscription';
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
  /** Display-only: renders a "Prices include GST" note under the total
   *  on every couple-facing surface. Never affects an amount. Optional
   *  so an older client bundle omitting it still validates. */
  gstInclusive: z.boolean().optional(),
  discount: discountSchema.nullable(),
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
    gstInclusive,
    discount,
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
      stripe_payment_enabled: stripePaymentEnabled,
      ...(gstInclusive !== undefined ? { gst_inclusive: gstInclusive } : {}),
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
  /** Null on first save of a new draft; uuid afterwards. */
  contractId: z.uuid().nullable(),
  /** The couple the contract is for. Required even on create, since a
   *  contract with no counterparty can't be rendered or sent. */
  coupleId: z.uuid(),
  title: z.string().max(200),
  content: z.record(z.string(), z.unknown()),
  expiresAt: z.string().nullable(),
});

export type SaveContractInput = z.infer<typeof saveContractSchema>;

/**
 * Create or update a contract draft.
 *
 * A null `contractId` inserts a fresh draft (numbered by
 * `generate_contract_number`) so the builder modal can open on an
 * unsaved document and only write a row once the MC saves. That
 * replaces the old flow, which inserted a row the moment the New
 * button was clicked and littered the list with empty drafts.
 *
 * The Starter plan's distinct-couple cap is checked here rather than
 * only in the UI: it's an entitlement, so the client can't be the one
 * enforcing it.
 */
export async function saveContractAction(
  input: SaveContractInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveContractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contract data.' };
  }
  const { contractId, coupleId, title, content, expiresAt } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    // content is a TipTap JSONContent tree — opaque to us; the
    // generated Database type narrows the column to `Json`, so we cast
    // at the boundary. The Zod schema already proved it's a record.
    const contentJson = content as unknown as Json;

    if (contractId) {
      const { error } = await supabase
        .from('contracts')
        .update({
          couple_id: coupleId,
          title: title.trim() || null,
          content: contentJson,
          expires_at: expiresAt,
        })
        .eq('id', contractId);
      if (error) throw error;
      return { ok: true, data: { id: contractId } };
    }

    const limitError = await contractLimitError(supabase, user, coupleId);
    if (limitError) return { ok: false, error: limitError };

    const { data: numData, error: numErr } = await supabase.rpc('generate_contract_number', {
      p_user_id: user.id,
    });
    if (numErr) throw numErr;

    const { data: inserted, error: insertErr } = await supabase
      .from('contracts')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        title: title.trim() || null,
        contract_number: numData as string,
        status: 'draft',
        content: contentJson,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (insertErr || !inserted) throw insertErr ?? new Error('contract insert returned no row');

    return { ok: true, data: { id: inserted.id } };
  } catch (err) {
    logger.error('[payments/actions] saveContractAction failed', {
      userId: user.id,
      contractId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the contract.' };
  }
}

/**
 * Starter-plan gate for creating a contract for a new couple.
 *
 * Returns a user-facing message when the plan caps distinct couples
 * with contracts and this couple would exceed it, or null when the
 * create is allowed (uncapped plan, or the couple already has one).
 */
async function contractLimitError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  coupleId: string,
): Promise<string | null> {
  const limit = contractCoupleLimit(user);
  if (limit === null) return null;

  const { data, error } = await supabase.from('contracts').select('couple_id');
  if (error) throw error;

  const distinct = new Set((data ?? []).map((row) => row.couple_id));
  if (distinct.has(coupleId) || distinct.size < limit) return null;

  return `Your plan covers contracts for ${limit} couples. Upgrade to add more.`;
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
