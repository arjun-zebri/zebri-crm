/**
 * Public lead-capture ingest endpoint.
 *
 * Unauthenticated: the capture token IS the capability. Rate-limited at the
 * public category, honeypot + timing bot-checked, Zod-validated, then handed
 * to the `submit_lead` SECURITY DEFINER RPC which scopes the write to the
 * token owner. On success the MC is emailed; on a plan-limit block the MC is
 * alerted + emailed so the lead is never silently lost. Errors are generic to
 * the visitor with detail logged server-side.
 *
 * @module app/api/lead/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendLeadNotificationEmail } from '@/lib/email';
import {
  isLikelyBot,
  type LeadSubmitInput,
  leadSubmitSchema,
} from '@/lib/lead-capture/schema';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// 5 / min / IP - a genuine visitor submits once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });

const ok = () => NextResponse.json({ ok: true });

/** Map the validated input to the email builder's lead shape. */
function leadFrom(input: LeadSubmitInput) {
  return {
    name: input.name,
    partnerName: input.partner_name,
    email: input.email,
    phone: input.phone,
    weddingDate: input.wedding_date,
    venue: input.venue,
    referralSource: input.referral_source,
    message: input.message,
  };
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, leadSubmitSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Bots get a silent success so scrapers learn nothing.
  if (isLikelyBot(input, Date.now())) return ok();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_lead', {
    token: input.token,
    p_payload: {
      name: input.name,
      partner_name: input.partner_name ?? '',
      email: input.email,
      phone: input.phone ?? '',
      wedding_date: input.wedding_date ?? '',
      venue: input.venue ?? '',
      referral_source: input.referral_source ?? '',
      message: input.message ?? '',
      // MC-defined custom answers; the RPC stores these on the submission and
      // folds them into the couple notes.
      custom: input.custom ?? [],
    } as Json,
  });

  if (error) {
    logger.error('[lead/submit] submit_lead RPC failed', error, { ip });
    return NextResponse.json({ error: 'Could not submit enquiry' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    mc_email?: string;
    business_name?: string;
  };

  if (result.error === 'not_found') {
    // Same handling as other public surfaces: never leak the token state.
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return NextResponse.json({ error: 'This form is not available.' }, { status: 404 });
  }

  if (result.error === 'plan_limit') {
    // Do not expose the MC's billing state to the visitor; accept + notify.
    if (result.mc_email) {
      await sendAlert({
        type: 'lead_blocked_plan_limit',
        severity: 'warn',
        userId: 'unknown',
        email: result.mc_email,
      });
      void sendLeadNotificationEmail({
        to: result.mc_email,
        mcBusinessName: result.business_name || 'your business',
        lead: leadFrom(input),
      });
    }
    return ok();
  }

  if (result.error === 'invalid') {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
  }

  if (result.ok && result.mc_email) {
    // Reply-to the couple so the MC can respond straight to the lead.
    void sendLeadNotificationEmail({
      to: result.mc_email,
      mcBusinessName: result.business_name || 'your business',
      lead: leadFrom(input),
      replyTo: input.email,
    });
    // Slack heads-up in addition to the email, so a new enquiry is visible in
    // the team channel even if the MC misses the email.
    await sendAlert({
      type: 'lead_new_enquiry',
      severity: 'info',
      userId: 'unknown',
      email: result.mc_email,
      // Only include the key when known (exactOptionalPropertyTypes: no explicit undefined).
      ...(result.business_name ? { businessName: result.business_name } : {}),
    });
  }
  return ok();
}
