import { describe, expect, it } from 'vitest';

import { matchesSuppressed, normaliseEmail, normaliseHandle } from '@/lib/outreach/services/suppression';

describe('normaliseEmail', () => {
  it('lower-cases and trims so one person is one address', () => {
    expect(normaliseEmail('  Jane@Example.COM ')).toBe('jane@example.com');
    expect(normaliseEmail('   ')).toBeNull();
    expect(normaliseEmail(null)).toBeNull();
  });
});

describe('normaliseHandle', () => {
  it('drops the @ and lower-cases, since handles are case-insensitive', () => {
    expect(normaliseHandle('@Jane_Weds')).toBe('jane_weds');
    expect(normaliseHandle('@@jane')).toBe('jane');
    expect(normaliseHandle('@')).toBeNull();
  });
});

describe('matchesSuppressed', () => {
  const set = { emails: new Set(['jane@example.com']), handles: new Set(['jane_weds']) };

  it('matches on a normalised email under a different casing', () => {
    expect(matchesSuppressed(set, { email: 'JANE@example.com', instagram_handle: null })).toBe(true);
  });

  it('matches on a handle even when the email is new', () => {
    expect(matchesSuppressed(set, { email: 'new@example.com', instagram_handle: '@Jane_Weds' })).toBe(true);
  });

  it('does not match a different person', () => {
    expect(matchesSuppressed(set, { email: 'other@example.com', instagram_handle: 'other' })).toBe(false);
    expect(matchesSuppressed(set, { email: null, instagram_handle: null })).toBe(false);
  });
});
