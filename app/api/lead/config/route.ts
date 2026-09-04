/**
 * Public lead-form config: the fields a third party needs to render a form
 * that matches the MC's own. Read-only, credential-free, wildcard CORS.
 * Returns exactly `{ enabled, fields }`; nothing about the owner. Also the
 * data source for a future inline (non-iframe) embed.
 *
 * @module app/api/lead/config/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseSearchParams } from '@/lib/api/validate';
import { leadApiError } from '@/lib/lead-capture/api-responses';
import { OPEN_CORS_HEADERS } from '@/lib/lead-capture/cors';
import { leadFormFields } from '@/lib/lead-capture/fields';
import { loadLeadFormConfig } from '@/lib/lead-capture/load-config';

// 60 / min / IP: a page load reads this once; the response is cacheable.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 60 });

const querySchema = z.object({ token: z.uuid() });

const HEADERS = { ...OPEN_CORS_HEADERS, 'cache-control': 'public, max-age=60' };

/** CORS preflight for the config endpoint. Always open, no token to check. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

/**
 * Look up a form by its capture token and report whether it is accepting
 * enquiries plus the fields a caller should render. Never returns the
 * allowed-origins list or the owning user id.
 */
export async function GET(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    const seconds = Math.ceil(retryAfter / 1000);
    return leadApiError(429, 'rate_limited', 'Too many requests.', { retry_after: seconds }, {
      ...OPEN_CORS_HEADERS,
      'Retry-After': String(seconds),
    });
  }

  // A malformed token is just an unknown one from the caller's point of view.
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.', {}, OPEN_CORS_HEADERS);
  }

  let config;
  try {
    config = await loadLeadFormConfig(parsed.data.token);
  } catch (err) {
    logger.error('[lead/config] lookup failed', err, { ip });
    return leadApiError(500, 'server_error', 'Could not load form.', {}, OPEN_CORS_HEADERS);
  }
  if (!config.found) {
    await recordInvalidTokenAttempt({ ip, surface: 'lead' });
    return leadApiError(404, 'form_not_found', 'This form is not available.', {}, OPEN_CORS_HEADERS);
  }

  const body = config.enabled
    ? { enabled: true, fields: leadFormFields(config.blocks) }
    : { enabled: false, fields: [] };
  return NextResponse.json(body, { headers: HEADERS });
}
