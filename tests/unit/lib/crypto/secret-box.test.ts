/**
 * Unit tests for `lib/crypto/secret-box` — the AES-256-GCM helper used to
 * store SMTP passwords at rest. Covers round-trip, fresh-IV-per-call, and
 * authenticated-encryption tamper/format rejection.
 */
import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';

// A fixed 32-byte key for the suite (never a real key).
process.env.EMAIL_CRED_KEY = Buffer.alloc(32, 7).toString('base64');

describe('secret-box', () => {
  it('round-trips a value without leaking the plaintext', () => {
    const c = encryptSecret('hunter2');
    expect(c).not.toContain('hunter2');
    expect(c.startsWith('v1:')).toBe(true);
    expect(decryptSecret(c)).toBe('hunter2');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('throws when the ciphertext has been tampered with', () => {
    const c = encryptSecret('secret');
    const parts = c.slice(3).split('.'); // strip "v1:"
    const tampered = `v1:${parts[0]}.${parts[1]}.${Buffer.from('different-bytes').toString('base64')}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws on an unrecognised format', () => {
    expect(() => decryptSecret('not-a-ciphertext')).toThrow();
  });
});
