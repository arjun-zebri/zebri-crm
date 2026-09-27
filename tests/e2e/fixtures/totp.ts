/**
 * RFC 6238 TOTP (SHA-1, 30 s step, 6 digits) with Node's crypto, so the
 * 2FA tests can act as an authenticator app without a new dependency.
 * Used by the e2e spec and the recovery-code integration test.
 */
import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode an RFC 4648 base32 secret, as Supabase returns it. */
export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const v = BASE32.indexOf(ch);
    if (v < 0) throw new Error(`Not base32: ${ch}`);
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The 6-digit code for `secret` at `timeMs` (defaults to now). */
export function totp(secret: string, timeMs: number = Date.now()): string {
  const counter = Math.floor(timeMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const bin = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 1_000_000).padStart(6, '0');
}
