/**
 * Validating a drawn signature image.
 *
 * A drawn signature travels as a base64 PNG data URL rather than a Storage
 * object (see the 20260903003000 migration for why). That makes it a caller-
 * supplied string reaching a `security definer` RPC granted to `anon`, so it is
 * validated in three places: here on the client before upload, here again in
 * the API route's Zod schema, and finally by a CHECK constraint plus a guard
 * inside `sign_contract_v2`.
 *
 * This module is the shared, pure half. No DOM, no network: safe on both sides.
 *
 * @module lib/contracts/signature-image
 */

/**
 * Maximum size of the base64 data URL, in characters.
 *
 * 128KB of base64 is roughly 96KB of PNG. A monochrome stroke on the pad's
 * 1200x400 backing store lands at 10-25KB, so this is generous while still
 * bounding a column that anonymous callers can write to.
 */
export const SIGNATURE_MAX_BYTES = 131_072

/**
 * PNG data URLs only.
 *
 * Deliberately not SVG: it would be smaller, but an SVG is a document that can
 * carry script, and the signature is rendered into a freshly-opened print
 * window. There is no upside worth that surface. Also deliberately not an
 * arbitrary URL, which would let a signer point the signature at anything and
 * would reintroduce the load race the data URL exists to avoid.
 */
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

/**
 * True when a string is a signature image this system will store.
 *
 * @param value - The candidate data URL.
 */
export function isValidSignatureDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length > SIGNATURE_MAX_BYTES) return false
  return PNG_DATA_URL.test(value)
}

/** How a signature was made. */
export type SignatureMode = 'typed' | 'drawn'

/**
 * Normalise a mode + image pair into what should actually be stored.
 *
 * Typed mode never carries an image, whatever the caller sent, so a client that
 * switches back to the Type tab after drawing cannot leave a stale drawing
 * attached to a typed signature.
 *
 * @param mode - The mode the signer chose.
 * @param image - The drawn image, if any.
 * @returns The pair to persist, or null when drawn mode has no valid image.
 */
export function normaliseSignature(
  mode: SignatureMode,
  image: string | null | undefined,
): { mode: SignatureMode; image: string | null } | null {
  if (mode !== 'drawn') return { mode: 'typed', image: null }
  if (!isValidSignatureDataUrl(image)) return null
  return { mode: 'drawn', image }
}
