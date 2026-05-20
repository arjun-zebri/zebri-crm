/**
 * Cron-route authorization.
 *
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header that Vercel
 * Cron (and any other authorized trigger) sends. Uses a constant-time
 * comparison so an attacker can't extract the secret one byte at a time
 * via timing — pure-JS impl works in node + edge + middleware runtimes
 * without pulling in `node:crypto`.
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   if (!isCronAuthorized(request)) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   // … actual cron work …
 * }
 * ```
 *
 * @module lib/api/cron-auth
 */

/**
 * Constant-time string comparison.
 *
 * Returns false immediately if lengths differ (early-return is the
 * unavoidable timing leak — but lengths of secrets aren't sensitive).
 * For equal-length strings, XOR-accumulates differences across every
 * byte so the wall-clock cost is identical for matching vs mismatching
 * inputs.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true iff the request's `Authorization` header carries the
 * configured CRON_SECRET. Returns false if `CRON_SECRET` is unset
 * (fail-closed). Never throws.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  return constantTimeEqual(header, `Bearer ${secret}`);
}
