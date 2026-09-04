/**
 * Machine-readable API reference for AI coding tools, per the llms.txt
 * convention. Same source as the public docs page.
 *
 * @module app/llms.txt/route
 */
import type { NextRequest } from 'next/server';

import { buildLlmsTxt } from '@/lib/lead-capture/api-reference';

/** Serve the lead-capture API reference as plain text at `/llms.txt`. */
export function GET(request: NextRequest) {
  return new Response(buildLlmsTxt(new URL(request.url).origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
