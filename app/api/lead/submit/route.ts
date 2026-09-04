/**
 * Public lead-capture ingest endpoint.
 *
 * Unauthenticated: the capture token IS the address (it is public in every
 * embed snippet). Rate-limited per IP, per-form CORS allowlist, Zod-validated,
 * required fields enforced from the form's own config, honeypot + timing
 * bot-checked, then handed to the `submit_lead` SECURITY DEFINER RPC which
 * scopes the write to the token owner. On success the MC is emailed; on a
 * plan-limit block the MC is alerted + emailed so the lead is never silently
 * lost.
 *
 * Error contract (documented in lib/lead-capture/api-reference.ts):
 * 400 validation_failed · 403 origin_not_allowed · 404 form_not_found ·
 * 409 form_disabled · 429 rate_limited · 500 server_error · 200 { ok: true }.
 *
 * Ordering matters: the token is parsed from a loose envelope first so the
 * form lookup and origin check happen before field validation. Every
 * response after the origin check carries CORS headers, so a third-party page
 * can read its 400s and 409s. Responses before it (bad JSON, unknown token)
 * are not readable cross-origin, which is fine: those are integration errors,
 * not runtime ones.
 *
 * @module app/api/lead/submit/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendLeadNotificationEmail } from '@/lib/email';
import { leadApiError, withHeaders, zodIssuesToFields } from '@/lib/lead-capture/api-responses';
import {
  corsHeaders,
  isAllowedOrigin,
  isSameOrigin,
  originOf,
  originOnly,
  requestHostOf,
} from '@/lib/lead-capture/cors';
import { leadFormFields, missingRequiredFields } from '@/lib/lead-capture/fields';
import { isOriginRegistered, loadLeadFormConfig } from '@/lib/lead-capture/load-config';
import { isLikelyBot, type LeadSubmitInput, leadSubmitSchema } from '@/lib/lead-capture/schema';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// 5 / min / IP - a genuine visitor submits once.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 });
// Preflights are cached by browsers, so this only stops runaway loops.
const preflightLimiter = inMemoryLimiter({ windowMs: 60_000, max: 60 });

/** Just enough to find the form; the rest of the body is validated later. */
const envelopeSchema = z.looseObject({ token: z.string().max(100) });

const ok = () => NextResponse.json({ ok: true });

/** Map the validated input to the email builder's lead shape. */
function leadFrom(input: LeadSubmitInput) {
  return {
    name: input.name,
    partnerName: input.partner_name,
    email: input.email ?? '',
    phone: input.phone,
    weddingDate: input.wedding_date,
    venue: input.venue,
    referralSource: input.referral_source,
    message: input.message,
  };
}

/** CORS preflight. See the module doc for why this is registry-wide, not per-form. */
export async function OPTIONS(request: NextRequest) {
  const origin = originOf(request);
  if (!origin) return new NextResponse(null, { status: 204, headers: { vary: 'origin' } });
  const { allowed } = await preflightLimiter.check(ipOf(request));
  if (!allowed) return new NextResponse(null, { status: 429 });

  let echo = isSameOrigin(origin, requestHostOf(request));
  if (!echo) {
    try {
      echo = await isOriginRegistered(origin);
    } catch (err) {
      logger.error('[lead/submit] preflight lookup failed', err, { origin });
    }
  }
  // vary: origin on every branch, echoing or not: a cache must never reuse a
  // 204 issued for one Origin when a different Origin asks for the same
  // preflight.
  return new NextResponse(null, {
    status: 204,
    headers: echo ? corsHeaders(origin) : { vary: 'origin' },
  });
}

/**
 * Validate, spam-check and store one public lead submission, then notify the
 * MC. See the module doc above for the full pipeline order (rate limit,
 * token lookup, origin check, field validation, honeypot/timing check, RPC
 * write) and the error contract each stage can return.
 */
export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const origin = originOf(request);

  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    const seconds = Math.ceil(retryAfter / 1000);
    return leadApiError(429, 'rate_limited', 'Too many submissions. Please try again shortly.', {
      retry_after: seconds,
    }, { 'Retry-After': String(seconds) });
  }

  const envelope = await parseJsonBody(request, envelopeSchema, (err) =>
    leadApiError(400, 'validation_failed', 'The request body must be JSON with a token.', {
      fields: err ? zodIssuesToFields(err.issues) : { _: 'Body must be JSON' },
    }),
  );
  if (!envelope.ok) return envelope.response;

  const token = envelope.data.token;
  const config = z.uuid().safeParse(token).success
    ? await loadLeadFormConfig(token).catch((err: unknown) => {
        logger.error('[lead/submit] config lookup failed', err, { ip });
        return null;
      })
    : { found: false as const };
  if (config === null) return leadApiError(500, 'server_error', 'Could not submit enquiry.');
  if (!config.found) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.');
  }

  const sameOrigin = origin !== null && isSameOrigin(origin, requestHostOf(request));
  if (origin && !sameOrigin && !isAllowedOrigin(origin, config.allowedOrigins)) {
    return leadApiError(403, 'origin_not_allowed', 'This site is not on the form’s allowed domains.');
  }
  // From here on the origin is trusted, so every response is readable by it.
  const cors = origin ? corsHeaders(origin) : {};
  const respond = (res: NextResponse) => withHeaders(res, cors);

  if (!config.enabled) {
    return respond(leadApiError(409, 'form_disabled', 'This form is not accepting enquiries right now.'));
  }

  const parsed = leadSubmitSchema.safeParse(envelope.data);
  if (!parsed.success) {
    return respond(
      leadApiError(400, 'validation_failed', 'Some fields are invalid.', {
        fields: zodIssuesToFields(parsed.error.issues),
      }),
    );
  }
  const input = parsed.data;

  const missing = missingRequiredFields(leadFormFields(config.blocks), input);
  if (Object.keys(missing).length > 0) {
    return respond(leadApiError(400, 'validation_failed', 'Some required fields are missing.', { fields: missing }));
  }

  // Bots get a silent success so scrapers learn nothing.
  if (isLikelyBot(input, Date.now())) return respond(ok());

  // Where the form lived: a third-party site's Origin, or for our own embed
  // the host page it was framed in. The referrer is only trusted from our own
  // origin and is reduced to a site, never stored as a full URL.
  const sourceOrigin = origin && !sameOrigin
    ? origin
    : sameOrigin && input.referrer
      ? originOnly(input.referrer)
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_lead', {
    token: input.token,
    p_payload: {
      name: input.name,
      partner_name: input.partner_name ?? '',
      email: input.email ?? '',
      phone: input.phone ?? '',
      wedding_date: input.wedding_date ?? '',
      venue: input.venue ?? '',
      referral_source: input.referral_source ?? '',
      message: input.message ?? '',
      // MC-defined custom answers; the RPC stores these on the submission and
      // folds them into the couple notes.
      custom: input.custom ?? [],
    } as Json,
    ...(sourceOrigin ? { p_source_origin: sourceOrigin } : {}),
  });

  if (error) {
    logger.error('[lead/submit] submit_lead RPC failed', error, { ip });
    return respond(leadApiError(500, 'server_error', 'Could not submit enquiry.'));
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string; mc_email?: string; business_name?: string };

  if (result.error === 'not_found') {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return respond(leadApiError(404, 'form_not_found', 'This form is not available.'));
  }
  if (result.error === 'invalid') {
    return respond(leadApiError(400, 'validation_failed', 'Some fields are invalid.', { fields: { name: 'Required' } }));
  }
  if (result.error === 'plan_limit') {
    // Do not expose the MC's billing state to the visitor; accept + notify.
    if (result.mc_email) {
      await sendAlert({ type: 'lead_blocked_plan_limit', severity: 'warn', userId: 'unknown', email: result.mc_email });
      void sendLeadNotificationEmail({
        to: result.mc_email,
        mcBusinessName: result.business_name || 'your business',
        lead: leadFrom(input),
      });
    }
    return respond(ok());
  }

  if (result.ok && result.mc_email) {
    void sendLeadNotificationEmail({
      to: result.mc_email,
      mcBusinessName: result.business_name || 'your business',
      lead: leadFrom(input),
      ...(input.email ? { replyTo: input.email } : {}),
    });
    await sendAlert({
      type: 'lead_new_enquiry',
      severity: 'info',
      userId: 'unknown',
      email: result.mc_email,
      ...(result.business_name ? { businessName: result.business_name } : {}),
    });
  }
  return respond(ok());
}
