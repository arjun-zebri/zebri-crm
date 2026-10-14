import { describe, expect, it } from 'vitest';

import {
  dedupeKey,
  normaliseEmail,
  normaliseFacebook,
  normaliseInstagram,
  normaliseState,
  normaliseWebsite,
  parseName,
  timezoneForState,
} from '@/lib/outreach/import/normalise';

describe('parseName', () => {
  it('drops titles and title-cases shouted names', () => {
    expect(parseName('MRS JANE SMITH')).toEqual({ first: 'Jane', last: 'Smith' });
    expect(parseName('Rev. Dr Paul de Silva')).toEqual({ first: 'Paul', last: 'de Silva' });
  });

  it('keeps deliberate casing', () => {
    expect(parseName('Mary McDonald')).toEqual({ first: 'Mary', last: 'McDonald' });
  });

  it('handles a single name', () => {
    expect(parseName('cher')).toEqual({ first: 'Cher', last: null });
  });
});

describe('normaliseState', () => {
  it('maps names and abbreviations', () => {
    expect(normaliseState('Victoria')).toBe('VIC');
    expect(normaliseState(' nsw ')).toBe('NSW');
    expect(normaliseState('Narnia')).toBeNull();
  });

  it('gives each state its timezone, Sydney when unknown', () => {
    expect(timezoneForState('WA')).toBe('Australia/Perth');
    expect(timezoneForState(null)).toBe('Australia/Sydney');
  });
});

describe('normaliseEmail', () => {
  it('lower-cases and strips mailto', () => {
    expect(normaliseEmail(' MAILTO:Jane@Example.COM.au ')).toBe('jane@example.com.au');
  });

  it('rejects junk', () => {
    expect(normaliseEmail('not an email')).toBeNull();
    expect(normaliseEmail('jane@')).toBeNull();
  });
});

describe('normaliseWebsite', () => {
  it('adds https and strips tracking params and trailing slash', () => {
    expect(normaliseWebsite('JaneCelebrant.com.au/?utm_source=x')).toBe('https://janecelebrant.com.au');
  });

  it('rejects social links and junk', () => {
    expect(normaliseWebsite('instagram.com/jane')).toBeNull();
    expect(normaliseWebsite('n/a')).toBeNull();
    expect(normaliseWebsite('two words')).toBeNull();
  });
});

describe('normaliseInstagram', () => {
  it('accepts URLs, @handles and bare handles', () => {
    expect(normaliseInstagram('https://www.instagram.com/Jane.Celebrant/?hl=en')).toBe('jane.celebrant');
    expect(normaliseInstagram('@jane_c')).toBe('jane_c');
    expect(normaliseInstagram('jane_c')).toBe('jane_c');
  });

  it('rejects non-profile paths', () => {
    expect(normaliseInstagram('https://instagram.com/p/abc123')).toBeNull();
    expect(normaliseInstagram('https://instagram.com/explore')).toBeNull();
  });
});

describe('normaliseFacebook', () => {
  it('keeps page URLs and drops share links', () => {
    expect(normaliseFacebook('facebook.com/JaneCelebrant/')).toBe('https://www.facebook.com/JaneCelebrant');
    expect(normaliseFacebook('https://www.facebook.com/sharer/sharer.php?u=x')).toBeNull();
  });
});

describe('dedupeKey', () => {
  it('is case and whitespace insensitive', () => {
    expect(dedupeKey(' Jane  Smith ', 'Bondi')).toBe(dedupeKey('jane smith', 'BONDI'));
  });
});
