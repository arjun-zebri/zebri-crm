/**
 * Symmetric secret encryption for credentials stored at rest.
 *
 * Used for the SMTP password an MC saves when they connect their own
 * mailbox (Settings → Public Page → Email): we must be able to read it
 * back to send mail, so it can't be hashed — it's encrypted with
 * AES-256-GCM under a server-only key (`EMAIL_CRED_KEY`) and only ever
 * decrypted server-side at send/verify time. The ciphertext is the only
 * form that touches the database, and it's never returned to the client.
 *
 * GCM gives us authenticated encryption: any tampering with the stored
 * ciphertext (or a wrong key) fails the auth-tag check and throws on
 * decrypt rather than returning garbage.
 *
 * Server-only — never import from a `'use client'` module.
 *
 * @module lib/crypto/secret-box
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
/** Version prefix so the format can evolve (e.g. key rotation) later. */
const VERSION = 'v1';

/**
 * Load the 32-byte AES key from `EMAIL_CRED_KEY` (base64). Throws if the
 * env var is missing or the wrong size, so a misconfigured deploy fails
 * fast instead of writing unrecoverable ciphertext.
 */
function loadKey(): Buffer {
  const raw = process.env.EMAIL_CRED_KEY;
  if (!raw) throw new Error('EMAIL_CRED_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('EMAIL_CRED_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

/**
 * Encrypt `plaintext` to a self-describing string:
 * `v1:<iv>.<authTag>.<ciphertext>` (each part base64). A fresh random IV
 * is used per call, so encrypting the same value twice yields different
 * ciphertexts.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;
}

/**
 * Decrypt a string produced by {@link encryptSecret}. Throws if the
 * format is unrecognised or the auth tag fails (tampering / wrong key).
 */
export function decryptSecret(ciphertext: string): string {
  const [version, body] = splitOnce(ciphertext, ':');
  if (version !== VERSION || !body) throw new Error('Unrecognised ciphertext format');

  const parts = body.split('.');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];

  const decipher = createDecipheriv(ALGORITHM, loadKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const out = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return out.toString('utf8');
}

/** Split on the first occurrence of `sep` only (the body may contain it). */
function splitOnce(value: string, sep: string): [string, string] {
  const i = value.indexOf(sep);
  if (i === -1) return [value, ''];
  return [value.slice(0, i), value.slice(i + 1)];
}
