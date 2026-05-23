/**
 * Send an invoice email to a couple.
 *
 * POST `/api/email/send-invoice` — looks up the invoice (RLS-gated),
 * grabs the linked couple's email, auto-enables the share token if
 * it isn't already, fires the templated invoice email via Resend,
 * and stamps `email_sent_at`. Returns `{ ok: true }`.
 *
 * Hardened in Phase 2C:
 * - **Zod-validated body** (`{ invoiceId: uuid }`); anything else → 400.
 * - **Rate-limited** to 5/min/user via `EMAIL_RATE_LIMITS.sendInvoice`
 *   — protects the couple's inbox from runaway loops.
 * - **Structured logging** replaces `console.error`.
 *
 * @module app/api/email/send-invoice/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendInvoiceEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  invoiceId: z.uuid(),
});

const limiter = inMemoryLimiter(EMAIL_RATE_LIMITS.sendInvoice);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed, retryAfter } = await limiter.check(`sendInvoice:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'email_rate_limit_hit',
      severity: 'warn',
      action: 'sendInvoice',
      userId: user.id,
      ip: ipOf(request),
    });
    return NextResponse.json(
      { error: 'Too many emails sent recently. Try again in a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { invoiceId } = parsed.data;

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, title, share_token, share_token_enabled, status, due_date, couples(email, name)',
    )
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const couple = Array.isArray(invoice.couples) ? invoice.couples[0] : invoice.couples;
  const coupleEmail = couple?.email?.trim();
  const coupleName = couple?.name || 'there';

  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 },
    );
  }

  if (!invoice.share_token_enabled) {
    await supabase
      .from('invoices')
      .update({
        share_token_enabled: true,
        status: invoice.status === 'draft' ? 'sent' : invoice.status,
      })
      .eq('id', invoiceId);
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoice.share_token}`;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your MC';

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const result = await sendInvoiceEmail({
    coupleEmail,
    coupleName,
    invoiceNumber: invoice.invoice_number,
    invoiceTitle: invoice.title,
    dueDate,
    shareUrl,
    mcBusinessName,
  });

  if (!result.ok) {
    logger.error('[email/send-invoice] resend failed', {
      userId: user.id,
      invoiceId,
      error: result.error,
    });
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  await supabase
    .from('invoices')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', invoiceId);

  return NextResponse.json({ ok: true });
}
