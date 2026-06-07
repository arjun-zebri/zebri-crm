/**
 * Send a quote email to a couple.
 *
 * POST `/api/email/send-quote` — looks up the quote (RLS-gated), grabs
 * the linked couple's email, auto-enables the share token if it isn't
 * already, fires the templated quote email via Resend, and stamps
 * `email_sent_at`. Returns `{ ok: true }`.
 *
 * Hardened in Phase 2C:
 * - **Zod-validated body** (`{ quoteId: uuid }`); anything else → 400.
 * - **Rate-limited** to 5/min/user via `EMAIL_RATE_LIMITS.sendQuote` —
 *   re-sends are legitimate (the modal has a "Resend email" button)
 *   but a runaway loop hammering a couple's inbox is the risk we're
 *   defending against.
 * - **Structured logging** replaces `console.error`.
 *
 * @module app/api/email/send-quote/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendQuoteEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  quoteId: z.uuid(),
});

const limiter = inMemoryLimiter(EMAIL_RATE_LIMITS.sendQuote);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed, retryAfter } = await limiter.check(`sendQuote:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'email_rate_limit_hit',
      severity: 'warn',
      action: 'sendQuote',
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
  const { quoteId } = parsed.data;

  // RLS scopes the SELECT to the authenticated user — even if a
  // forged quoteId pointed at someone else's row, the join would
  // return no rows.
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, title, share_token, share_token_enabled, status, couples(email, name)',
    )
    .eq('id', quoteId)
    .eq('user_id', user.id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const couple = Array.isArray(quote.couples) ? quote.couples[0] : quote.couples;
  const coupleEmail = couple?.email?.trim();
  const coupleName = couple?.name || 'there';

  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 },
    );
  }

  // Sending implicitly says "I want the couple to be able to view
  // this" and "this quote is no longer a draft". The two flips were
  // previously bundled inside one if-block gated on
  // `!share_token_enabled` — but a later migration made
  // `share_token_enabled` default to `true` on insert, so for any
  // newly-created quote the gate was always false and the status
  // flip never ran. Now they fire independently so each transitions
  // on its own merit.
  const updates: Record<string, unknown> = {};
  if (!quote.share_token_enabled) updates.share_token_enabled = true;
  if (quote.status === 'draft') updates.status = 'sent';
  if (Object.keys(updates).length > 0) {
    await supabase.from('quotes').update(updates).eq('id', quoteId);
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quote/${quote.share_token}`;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your MC';

  const result = await sendQuoteEmail({
    coupleEmail,
    coupleName,
    quoteNumber: quote.quote_number,
    quoteTitle: quote.title,
    shareUrl,
    mcBusinessName,
  });

  if (!result.ok) {
    logger.error('[email/send-quote] resend failed', {
      userId: user.id,
      quoteId,
      error: result.error,
    });
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  await supabase
    .from('quotes')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', quoteId);

  return NextResponse.json({ ok: true });
}
