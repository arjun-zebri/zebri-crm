/**
 * Unit tests for the Public Page pure helpers
 * (`lib/settings/public-page`): subdomain normalisation/validation and
 * the `from`-header composer used for the connected-mailbox sender.
 */
import { describe, expect, it } from 'vitest';

import {
  composeFromHeader,
  isValidSubdomain,
  normalizeSubdomain,
  RESERVED_SUBDOMAINS,
} from '@/lib/settings/public-page';

describe('normalizeSubdomain', () => {
  it('lowercases, trims, and hyphenates non-alphanumerics', () => {
    expect(normalizeSubdomain('  Jane & Co  ')).toBe('jane-co');
    expect(normalizeSubdomain("O'Brien Weddings")).toBe('o-brien-weddings');
  });

  it('collapses repeats and strips leading/trailing hyphens', () => {
    expect(normalizeSubdomain('--a--b--')).toBe('a-b');
    expect(normalizeSubdomain('a   b')).toBe('a-b');
  });
});

describe('isValidSubdomain', () => {
  it('accepts DNS-label shaped slugs', () => {
    expect(isValidSubdomain('jane-weddings')).toBe(true);
    expect(isValidSubdomain('mc123')).toBe(true);
  });

  it('rejects empty, hyphen-edged, and over-long values', () => {
    expect(isValidSubdomain('')).toBe(false);
    expect(isValidSubdomain('-jane')).toBe(false);
    expect(isValidSubdomain('jane-')).toBe(false);
    expect(isValidSubdomain('a'.repeat(64))).toBe(false);
  });

  it('rejects reserved words', () => {
    for (const reserved of RESERVED_SUBDOMAINS) {
      expect(isValidSubdomain(reserved)).toBe(false);
    }
  });
});

describe('composeFromHeader', () => {
  it('quotes the display name in front of the address', () => {
    expect(composeFromHeader("Jane's Weddings", 'hello@janes.com')).toBe(
      '"Jane\'s Weddings" <hello@janes.com>',
    );
  });

  it('strips header-breaking characters from the display name', () => {
    expect(composeFromHeader('Bad"\r\nName', 'hi@x.com')).toBe('"Bad Name" <hi@x.com>');
  });

  it('falls back to the bare address when the name is empty', () => {
    expect(composeFromHeader('   ', 'hi@x.com')).toBe('hi@x.com');
  });
});
