/**
 * Signed, stateless unsubscribe tokens.
 *
 * The Spam Act Regulations forbid making a recipient log in (or pay) to opt
 * out, so the public unsubscribe link (`/unsubscribe/[token]`) has to carry
 * its own capability: nothing to sign in with, and no session to key a
 * lookup against. This module makes that capability a **signed, self-verifying
 * token** rather than a row in a new table:
 *
 * - **Not guessable.** The payload (owner id, couple id, address) is
 *   meaningless without the signature. An attacker who can see one couple's
 *   token learns nothing that helps them forge a token for a different
 *   address: HMAC-SHA256 has no exploitable structure short of finding the
 *   32-byte server secret.
 * - **Not forgeable.** The signature is computed with a server-only secret
 *   (`UNSUBSCRIBE_TOKEN_SECRET`), so nothing short of that secret leaking can
 *   produce a token that verifies. Verification is constant-time
 *   (`timingSafeEqual`) so a network attacker can't recover the signature
 *   byte-by-byte via timing.
 * - **No DB lookup required.** Unlike `contract_signers.sign_token` or
 *   `couples.portal_token`, there is no per-recipient row to mint this
 *   against. Email sends happen far more often than a couple ever visits
 *   their portal, and minting a durable row per send would mean a new table
 *   and a cleanup story for no security benefit. Verifying is pure
 *   computation; only the *result* of a valid unsubscribe touches the
 *   database.
 * - **No expiry.** An opt-out request is a legal right, not a session, so a
 *   link from a six-month-old email must still work. The token is scoped
 *   entirely by content (whose list, which address), never by time.
 *
 * WHAT A FORWARDED EMAIL DOES. The token encodes the *address the email was
 * sent to*, not "whoever clicks". If partner A forwards the email to partner
 * B at a different address, B clicking the link unsubscribes A's address (the
 * one actually on the mailing list) and does nothing to B's own address,
 * which was never on it and never opted in to anything by this token. If both
 * partners share one stored address (the common case), either of them
 * clicking suppresses that one address, and a second click by the other
 * partner (or a second click by the same person) is a no-op; see
 * {@link ../../app/api/unsubscribe/route} for the idempotent write.
 *
 * @module lib/email/unsubscribe-token
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

/** Current token format version. Bump if the payload shape ever changes,
 *  so a verifier can reject an old-format token cleanly instead of
 *  misreading it. */
const TOKEN_VERSION = 1;

const payloadSchema = z.object({
  v: z.literal(TOKEN_VERSION),
  /** Owner (the MC whose mailing list this is); scopes the suppression
   *  row and the `couples` rows the confirm step updates. */
  uid: z.uuid(),
  /** The couple this send was for; shown on the confirmation page so the
   *  visitor knows which relationship they're opting out of. Not used to
   *  scope the write: suppression is keyed on the address (see the Task 10
   *  migration), so the confirm step updates every couple of this owner
   *  sharing this address, not just this one. */
  cid: z.uuid(),
  /** The address this token unsubscribes. Lower-cased at mint time so it
   *  matches `email_suppression`'s case-insensitive unique index without
   *  needing a fresh DB read to normalise it. */
  email: z.email(),
});

/** Decoded, verified contents of an unsubscribe token. */
export type UnsubscribeTokenPayload = z.infer<typeof payloadSchema>;

/** Arguments to {@link createUnsubscribeToken}. */
export interface UnsubscribeTokenArgs {
  userId: string;
  coupleId: string;
  email: string;
}

function secret(): string {
  // Read lazily (call-time, not module-load-time) so importing this module
  // never throws before the env is configured; the same lazy pattern
  // `lib/email/dispatch.ts` uses for the Resend client.
  const value = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!value) throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not set');
  return value;
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

/**
 * Mint a signed unsubscribe token for one (owner, couple, address) triple.
 *
 * Called at email-send time (a later task wires this into the outbound
 * templates); also used directly by tests to build a valid token without
 * going through a real send.
 */
export function createUnsubscribeToken({ userId, coupleId, email }: UnsubscribeTokenArgs): string {
  const payload: UnsubscribeTokenPayload = {
    v: TOKEN_VERSION,
    uid: userId,
    cid: coupleId,
    email: email.trim().toLowerCase(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

/**
 * Verify a token and return its payload, or `null` if the token is
 * malformed, tampered with, or signed under a different secret.
 *
 * Never throws: a hostile or corrupted input is just an invalid token, not
 * an exceptional condition the caller has to catch.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  // Compare the base64url *strings*, not the decoded bytes. A 32-byte HMAC
  // encodes to 43 chars whose last char carries 2 padding bits, and Node's
  // decoder ignores those bits, so several distinct strings decode to the
  // same bytes (e.g. `...rA` and `...rB`). Comparing decoded bytes would
  // accept those altered tokens as genuine; the minted string is canonical,
  // so anything that differs from it by even one character is rejected.
  const expected = Buffer.from(signPayload(payloadB64), 'utf8');
  const actual = Buffer.from(signatureB64, 'utf8');
  // Constant-time comparison, and a length check before it: timingSafeEqual
  // throws on mismatched lengths rather than returning false, and the
  // lengths themselves aren't secret (a well-formed signature is always 43
  // chars) so bailing early here leaks nothing new.
  if (expected.length !== actual.length || expected.length === 0) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  try {
    const json: unknown = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const parsed = payloadSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
