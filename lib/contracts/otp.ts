/**
 * One-time codes for contract signer verification.
 *
 * Server-only: imports `node:crypto`. The plaintext code exists in exactly two
 * places, the email and the signer's head. What is stored is a salted SHA-256,
 * and the comparison happens here in Node rather than in SQL, so the database
 * never sees the code at all.
 *
 * WHY SHA-256 AND NOT BCRYPT/ARGON2. A reviewer will reach for a slow KDF on
 * reflex, so the reasoning is written down: the secret is a 6-digit code with a
 * 10-minute TTL and a 5-attempt lockout. A slow KDF defends against OFFLINE
 * cracking of a stolen hash table, which is not the threat here. An attacker
 * has no path to the hash (the table has no anon policy and the reading RPC is
 * service_role only), and even with the hash the keyspace is exhausted in
 * milliseconds regardless of the algorithm. The control that actually matters
 * is the attempt cap. A slow KDF would only add latency to a request a signer
 * is waiting on.
 *
 * @module lib/contracts/otp
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** Digits in a code. Six is the familiar length and is easy to read aloud. */
export const OTP_LENGTH = 6

/** How long a code stays valid, in seconds. */
export const OTP_TTL_SECONDS = 600

/**
 * Wrong guesses before the code is locked and consumed.
 *
 * Five is generous for a mistyped digit while leaving a 6-digit keyspace
 * (1,000,000) effectively unguessable: an attacker gets five tries per issued
 * code, and issuing is itself rate-limited per token.
 */
export const OTP_MAX_ATTEMPTS = 5

/**
 * Generate a code using a CSPRNG.
 *
 * `randomInt`, never `Math.random`: the latter is predictable from prior
 * output, which would let an attacker who can trigger code issuance predict the
 * next one.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

/**
 * A per-code random salt, so two signers issued the same code do not share a
 * hash.
 *
 * `randomBytes` rather than `randomInt`: Node caps randomInt's range at 2^48,
 * and a salt wants full-width entropy rather than a bounded integer.
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex')
}

/** Salted SHA-256 of a code, hex. */
export function hashOtp(code: string, salt: string): string {
  return createHash('sha256').update(`${code}:${salt}`).digest('hex')
}

/**
 * Constant-time comparison of a submitted code against a stored hash.
 *
 * Both operands are fixed 32-byte digests, so the lengths always match and
 * `timingSafeEqual` cannot throw or leak through an early return the way a
 * plain `===` on the hex strings would.
 *
 * @param code - What the signer typed.
 * @param salt - The stored salt.
 * @param hash - The stored hex digest.
 */
export function verifyOtp(code: string, salt: string, hash: string): boolean {
  const expected = Buffer.from(hash, 'hex')
  // A malformed stored hash can never match; bail before timingSafeEqual,
  // which throws on a length mismatch.
  if (expected.length !== 32) return false
  return timingSafeEqual(Buffer.from(hashOtp(code, salt), 'hex'), expected)
}

/**
 * Mask an address for display: `s••@gmail.com`.
 *
 * The signing page tells the signer WHERE the code went, but never the full
 * address: whoever holds the link is not necessarily the signer, and echoing
 * the address back would hand a forwarded-link holder the target's email.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '•••'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const head = local.slice(0, 1)
  return `${head}${'•'.repeat(Math.max(local.length - 1, 1))}${domain}`
}
