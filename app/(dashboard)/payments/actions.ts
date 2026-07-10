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
  /** Provenance: the accepted proposal this invoice was generated
   *  from. Items stay a snapshot; this never feeds rendering.
   *  Nullish so an older client bundle omitting it still validates. */
  proposalId: z.uuid().nullish(),
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
    proposalId,
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
      // Written only when the client sent the field, so an older
      // bundle mid-deploy can't blank existing provenance.
      ...(proposalId !== undefined ? { proposal_id: proposalId } : {}),
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
  /** Linked accepted proposal: drives {{total_amount}} /
   *  {{deposit_amount}} and the signed→deposit-invoice path.
   *  Nullish so an older client bundle omitting it still validates. */
  proposalId: z.uuid().nullish(),
});

export type SaveContractInput = z.infer<typeof saveContractSchema>;

export async function saveContractAction(
  input: SaveContractInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveContractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contract data.' };
  }
  const { contractId, title, content, expiresAt, quoteId, proposalId } = parsed.data;

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
        ...(proposalId !== undefined ? { proposal_id: proposalId } : {}),
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

/* ─── Proposals (packages → send → accept → invoice) ───────────── */

const proposalItemSchema = z.object({
  /** Client-side key only; rows are always re-inserted on save. */
  id: z.string(),
  description: z.string().max(500),
  amount: z.number().min(0),
  isAddon: z.boolean(),
  /** MC's pre-tick; only meaningful when isAddon. */
  defaultIncluded: z.boolean(),
});

const proposalOptionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  /** Provenance: the package this option snapshotted from. */
  sourcePackageId: z.uuid().nullable(),
  depositPercent: z.number().min(0).max(100).nullable(),
  gstInclusive: z.boolean(),
  weekendLoadingPercent: z.number().min(0).max(100).nullable(),
  items: z.array(proposalItemSchema).max(100),
});

const saveProposalSchema = z.object({
  /** Null on first save of a new draft; uuid afterwards. */
  proposalId: z.uuid().nullable(),
  coupleId: z.uuid(),
  title: z.string().max(200),
  notes: z.string().max(5000).nullable(),
  expiresAt: z.string().nullable(),
  options: z.array(proposalOptionSchema).min(1).max(6),
});

export type SaveProposalInput = z.infer<typeof saveProposalSchema>;

/** Base-items total of one option draft (add-ons are extras). */
function optionBaseTotal(option: z.infer<typeof proposalOptionSchema>): number {
  return option.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.amount), 0);
}

/**
 * Create or update a proposal with its full option/item tree.
 *
 * Options + items are wiped and re-inserted in draft order (the same
 * source-of-truth pattern as quote items and packages). Safe because
 * nothing references option/item ids until acceptance — and accepted
 * or declined proposals are REJECTED here outright: they are the
 * record of what a couple agreed to, so edits must go through
 * `duplicateProposalAction` and a fresh send.
 */
export async function saveProposalAction(
  input: SaveProposalInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveProposalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid proposal data.' };
  }
  const { proposalId, coupleId, title, notes, expiresAt, options } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // List display shows the primary (first) option's base total until
  // acceptance overwrites it with the accepted selection's total.
  const subtotal = optionBaseTotal(options[0]!);

  try {
    let effectiveId = proposalId;

    if (effectiveId) {
      const { data: existing, error: readErr } = await supabase
        .from('proposals')
        .select('status')
        .eq('id', effectiveId)
        .single();
      if (readErr || !existing) return { ok: false, error: 'Proposal not found.' };
      if (existing.status === 'accepted' || existing.status === 'declined') {
        return {
          ok: false,
          error: 'This proposal has been responded to and is locked. Duplicate it to send an updated version.',
        };
      }

      const { error } = await supabase
        .from('proposals')
        .update({
          couple_id: coupleId,
          title,
          notes,
          expires_at: expiresAt,
          subtotal,
        })
        .eq('id', effectiveId);
      if (error) throw error;

      // Wipe options (items cascade); re-insert below.
      const { error: wipeErr } = await supabase
        .from('proposal_options')
        .delete()
        .eq('proposal_id', effectiveId);
      if (wipeErr) throw wipeErr;
    } else {
      const { data: numData, error: numErr } = await supabase.rpc('generate_proposal_number', {
        p_user_id: user.id,
      });
      if (numErr) throw numErr;
      const { data: inserted, error: pErr } = await supabase
        .from('proposals')
        .insert({
          user_id: user.id,
          couple_id: coupleId,
          title,
          proposal_number: numData as string,
          status: 'draft',
          notes,
          expires_at: expiresAt,
          subtotal,
        })
        .select('id')
        .single();
      if (pErr || !inserted) throw pErr ?? new Error('proposal insert returned no row');
      effectiveId = inserted.id;
    }

    // Options one-by-one (each returns its id for the item batch);
    // proposals hold ≤6 options so the round-trips stay trivial.
    for (const [idx, option] of options.entries()) {
      const { data: optRow, error: oErr } = await supabase
        .from('proposal_options')
        .insert({
          proposal_id: effectiveId,
          user_id: user.id,
          position: idx + 1,
          title: option.title,
          description: option.description,
          source_package_id: option.sourcePackageId,
          deposit_percent: option.depositPercent,
          gst_inclusive: option.gstInclusive,
          weekend_loading_percent: option.weekendLoadingPercent,
          subtotal: optionBaseTotal(option),
        })
        .select('id')
        .single();
      if (oErr || !optRow) throw oErr ?? new Error('option insert returned no row');

      if (option.items.length > 0) {
        const { error: iErr } = await supabase.from('proposal_option_items').insert(
          option.items.map((item, itemIdx) => ({
            option_id: optRow.id,
            user_id: user.id,
            description: item.description,
            amount: item.amount,
            is_addon: item.isAddon,
            default_included: item.isAddon ? item.defaultIncluded : false,
            position: (itemIdx + 1) * 1000,
          })),
        );
        if (iErr) throw iErr;
      }
    }

    return { ok: true, data: { id: effectiveId } };
  } catch (err) {
    logger.error('[payments/actions] saveProposalAction failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not save the proposal. Please try again.' };
  }
}

/* ─── deleteProposalAction ─────────────────────────────────────── */

export async function deleteProposalAction(
  proposalId: string,
): Promise<ActionResult<void>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { error } = await supabase.from('proposals').delete().eq('id', parsed.data);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error('[payments/actions] deleteProposalAction failed', {
      userId: user.id,
      proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not delete the proposal.' };
  }
}

/* ─── duplicateProposalAction ──────────────────────────────────── */

/**
 * Clone a proposal as a fresh draft (new number, new share token,
 * cleared acceptance state). The sanctioned way to revise an
 * already-responded proposal — the original stays as the record.
 */
export async function duplicateProposalAction(
  proposalId: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = z.uuid().safeParse(proposalId);
  if (!parsed.success) return { ok: false, error: 'Invalid proposal ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    const { data: source, error: sErr } = await supabase
      .from('proposals')
      .select('couple_id, title, notes, expires_at, subtotal')
      .eq('id', parsed.data)
      .single();
    if (sErr || !source) return { ok: false, error: 'Proposal not found.' };

    const { data: options, error: oErr } = await supabase
      .from('proposal_options')
      .select('id, position, title, description, source_package_id, deposit_percent, gst_inclusive, weekend_loading_percent, subtotal')
      .eq('proposal_id', parsed.data)
      .order('position', { ascending: true });
    if (oErr) throw oErr;

    const { data: items, error: iErr } = await supabase
      .from('proposal_option_items')
      .select('option_id, description, amount, is_addon, default_included, position')
      .eq('user_id', user.id)
      .in('option_id', (options ?? []).map((o) => o.id))
      .order('position', { ascending: true });
    if (iErr) throw iErr;

    const { data: numData, error: numErr } = await supabase.rpc('generate_proposal_number', {
      p_user_id: user.id,
    });
    if (numErr) throw numErr;

    const { data: created, error: cErr } = await supabase
      .from('proposals')
      .insert({
        user_id: user.id,
        couple_id: source.couple_id,
        title: `${source.title} (copy)`,
        proposal_number: numData as string,
        status: 'draft',
        notes: source.notes,
        expires_at: source.expires_at,
        subtotal: source.subtotal,
      })
      .select('id')
      .single();
    if (cErr || !created) throw cErr ?? new Error('proposal insert returned no row');

    for (const option of options ?? []) {
      const { data: optRow, error: noErr } = await supabase
        .from('proposal_options')
        .insert({
          proposal_id: created.id,
          user_id: user.id,
          position: option.position,
          title: option.title,
          description: option.description,
          source_package_id: option.source_package_id,
          deposit_percent: option.deposit_percent,
          gst_inclusive: option.gst_inclusive,
          weekend_loading_percent: option.weekend_loading_percent,
          subtotal: option.subtotal,
        })
        .select('id')
        .single();
      if (noErr || !optRow) throw noErr ?? new Error('option insert returned no row');

      const optionItems = (items ?? []).filter((item) => item.option_id === option.id);
      if (optionItems.length > 0) {
        const { error: niErr } = await supabase.from('proposal_option_items').insert(
          optionItems.map((item) => ({
            option_id: optRow.id,
            user_id: user.id,
            description: item.description,
            amount: item.amount,
            is_addon: item.is_addon,
            default_included: item.default_included,
            position: item.position,
          })),
        );
        if (niErr) throw niErr;
      }
    }

    return { ok: true, data: { id: created.id } };
  } catch (err) {
    logger.error('[payments/actions] duplicateProposalAction failed', {
      userId: user.id,
      proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'Could not duplicate the proposal.' };
  }
}
