// @vitest-environment node
/**
 * Recovery-code generation, hashing and matching (Phase 4, Task 23). The
 * database side (issue, spend, count against the real table) is covered
 * by tests/integration/rls/mfa-recovery-codes.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { RECOVERY_CODE_COUNT } from '@/lib/auth/mfa';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  matchRecoveryCode,
  normaliseRecoveryCode,
} from '@/lib/auth/recovery-codes';

describe('generateRecoveryCodes', () => {
  it('draws ten distinct xxxxx-xxxxx codes from the unambiguous alphabet', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9a-hjkmnp-z]{5}-[2-9a-hjkmnp-z]{5}$/);
    }
  });
});

describe('normaliseRecoveryCode', () => {
  it('forgives case, spaces and the hyphen', () => {
    expect(normaliseRecoveryCode(' ABCDE-FGHJK ')).toBe('abcdefghjk');
    expect(normaliseRecoveryCode('abcde fghjk')).toBe('abcdefghjk');
  });
});

describe('hash and match', () => {
  it('uses a fresh salt per code, so equal codes do not share a hash', async () => {
    const a = await hashRecoveryCode('abcde-fghjk');
    const b = await hashRecoveryCode('abcde-fghjk');
    expect(a.salt).not.toBe(b.salt);
    expect(a.codeHash).not.toBe(b.codeHash);
    expect(a.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the right row however the code is typed, and nothing else', async () => {
    const [c1, c2] = generateRecoveryCodes(2) as [string, string];
    const h1 = await hashRecoveryCode(c1);
    const h2 = await hashRecoveryCode(c2);
    const rows = [
      { id: 'row-1', salt: h1.salt, code_hash: h1.codeHash },
      { id: 'row-2', salt: h2.salt, code_hash: h2.codeHash },
    ];
    expect(await matchRecoveryCode(c2, rows)).toBe('row-2');
    expect(await matchRecoveryCode(c1.toUpperCase().replace('-', ' '), rows)).toBe('row-1');
    expect(await matchRecoveryCode('22222-22222', rows)).toBeNull();
  });

  it('rejects input of the wrong length without hashing', async () => {
    const h = await hashRecoveryCode('abcde-fghjk');
    const rows = [{ id: 'r', salt: h.salt, code_hash: h.codeHash }];
    expect(await matchRecoveryCode('abcde', rows)).toBeNull();
    expect(await matchRecoveryCode('abcde-fghjk-x', rows)).toBeNull();
  });

  it('matches nothing against an empty list (every code spent)', async () => {
    expect(await matchRecoveryCode('abcde-fghjk', [])).toBeNull();
  });
});
