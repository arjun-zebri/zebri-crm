import { describe, expect, it } from 'vitest';

import {
  changePasswordSchema,
  loginSchema,
  passwordSchema,
  passwordStrength,
  resetPasswordRequestSchema,
  sameOriginPathSchema,
  signupSchema,
  updatePasswordSchema,
} from '@/lib/auth/schemas';

describe('sameOriginPathSchema', () => {
  it.each(['/couples', '/settings?tab=billing', '/contracts/123'])('accepts %s', (p) => {
    expect(sameOriginPathSchema.safeParse(p).success).toBe(true);
  });

  it.each([
    '//evil.com',
    '///evil.com',
    'http://evil.com',
    'https://evil.com/x',
    'javascript:alert(1)',
    '',
    'relative',
  ])('rejects %s', (p) => {
    expect(sameOriginPathSchema.safeParse(p).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each([
    ['Pass-Word-123!', true],
    ['Sup3r-Secret-Pass!', true],
  ])('accepts strong %s', (p, ok) => {
    expect(passwordSchema.safeParse(p).success).toBe(ok);
  });

  it.each([
    'short!',
    'no-numbers-here!',
    'NoSymbols123',
    'nouppercase123!',
    'NOLOWERCASE123!',
    'OnlyLetters',
    '12345678901234',
  ])('rejects %s', (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('returns null for empty input', () => {
    expect(passwordStrength('')).toBeNull();
  });

  it('grades weak / medium / strong correctly', () => {
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('Password1')).toBe('medium');
    expect(passwordStrength('Sup3r-Secret-Pass!')).toBe('strong');
  });
});

describe('loginSchema', () => {
  it('accepts valid login + optional next', () => {
    expect(
      loginSchema.safeParse({
        email: 'user@example.com',
        password: 'whatever',
        next: '/couples',
      }).success,
    ).toBe(true);
  });

  it('rejects open-redirect next values', () => {
    const r = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'x',
      next: '//evil.com',
    });
    expect(r.success).toBe(false);
  });

  it('lowercases email', () => {
    const r = loginSchema.safeParse({ email: 'User@Example.COM', password: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@example.com');
  });
});

describe('signupSchema', () => {
  it('requires display + business name and strong password', () => {
    const r = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'Sup3r-Secret-Pass!',
      displayName: 'Jane',
      businessName: 'Jane MC',
    });
    expect(r.success).toBe(true);
  });

  it('trims display + business names', () => {
    const r = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'Sup3r-Secret-Pass!',
      displayName: '  Jane  ',
      businessName: '  Jane MC  ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.displayName).toBe('Jane');
      expect(r.data.businessName).toBe('Jane MC');
    }
  });

  it('rejects weak passwords', () => {
    const r = signupSchema.safeParse({
      email: 'u@x.com',
      password: 'short',
      displayName: 'a',
      businessName: 'b',
    });
    expect(r.success).toBe(false);
  });
});

describe('resetPasswordRequestSchema', () => {
  it('accepts a valid email', () => {
    expect(resetPasswordRequestSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects malformed email', () => {
    expect(resetPasswordRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('updatePasswordSchema', () => {
  it('requires both passwords to match and be strong', () => {
    const ok = updatePasswordSchema.safeParse({
      password: 'Sup3r-Secret-Pass!',
      confirmPassword: 'Sup3r-Secret-Pass!',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects mismatched confirm', () => {
    const r = updatePasswordSchema.safeParse({
      password: 'Sup3r-Secret-Pass!',
      confirmPassword: 'Sup3r-Secret-Diff!',
    });
    expect(r.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('requires current + new + confirm matching', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'whatever',
        password: 'Sup3r-Secret-Pass!',
        confirmPassword: 'Sup3r-Secret-Pass!',
      }).success,
    ).toBe(true);
  });

  it('rejects when current is empty', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: '',
        password: 'Sup3r-Secret-Pass!',
        confirmPassword: 'Sup3r-Secret-Pass!',
      }).success,
    ).toBe(false);
  });
});
