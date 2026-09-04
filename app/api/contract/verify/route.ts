/**
 * Public document-fingerprint lookup.
 *
 * This is what makes the hash printed on a certificate useful rather than
 * decorative: someone holding only the PDF (a venue, a solicitor, a tribunal)
 * can confirm it corresponds to a signed contract Zebri holds.
 *
 * Looks up BY HASH ONLY, never by token, and returns no document content. The
 * signer names it does return are an acceptable disclosure, because the hash is
 * obtainable only from the executed PDF, which the holder already has.
 *
 * Honest limitation, stated in the docs and worth repeating here: this proves
 * the record Zebri stores matches the PDF you hold. It does not prove Zebri did
 * not alter both, because Zebri holds both. Real tamper-evidence would need
 * digests published to an external transparency log.
 *
 * @module app/api/contract/verify/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { CONTRACT_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseSearchParams } from '@/lib/api/validate';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.verifyHash);

const querySchema = z.object({
  // A full 64-char digest or nothing. There is no partial-match lookup: that
  // would turn this into an enumeration oracle over signed contracts.
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'Enter the full fingerprint'),
});

export async function GET(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verify_contract_hash', {
    p_hash: parsed.data.hash,
  });

  if (error) {
    logger.error('[contract/verify] verify_contract_hash failed', error, {});
    return NextResponse.json({ error: 'Could not check that fingerprint' }, { status: 500 });
  }

  return NextResponse.json(data ?? { found: false });
}
