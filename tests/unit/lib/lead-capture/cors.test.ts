/**
 * Unit tests for the public lead API CORS rules.
 *
 * @module tests/unit/lib/lead-capture/cors
 */
import { describe, expect, it } from 'vitest';

import {
  corsHeaders,
  hostOf,
  isAllowedOrigin,
  isSameOrigin,
  OPEN_CORS_HEADERS,
  originFromWebsite,
  originOf,
  originOnly,
  parseAllowedOrigin,
  withWwwSibling,
  requestHostOf,
} from '@/lib/lead-capture/cors';

describe('parseAllowedOrigin', () => {
  it.each([
    ['https://www.example.com', 'https://www.example.com'],
    ['  HTTPS://WWW.Example.COM  ', 'https://www.example.com'],
    ['https://example.com:443', 'https://example.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['https://shop.example.com:8443', 'https://shop.example.com:8443'],
  ])('accepts and normalises %s', (input, expected) => {
    expect(parseAllowedOrigin(input)).toEqual({ ok: true, origin: expected });
  });

  it.each([
    [''],
    ['example.com'],
    ['ftp://example.com'],
    ['https://example.com/'],
    ['https://example.com/contact'],
    ['https://example.com?x=1'],
    ['https://example.com#top'],
    ['https://user:pw@example.com'],
    ['https://exa mple.com'],
    ['javascript:alert(1)'],
  ])('rejects %s', (input) => {
    const result = parseAllowedOrigin(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('request helpers', () => {
  it('originOf returns the Origin header or null', () => {
    expect(originOf(new Request('http://x/', { headers: { origin: 'https://a.com' } }))).toBe('https://a.com');
    expect(originOf(new Request('http://x/'))).toBeNull();
  });

  it('requestHostOf prefers x-forwarded-host, then host, then the URL', () => {
    expect(
      requestHostOf(
        new Request('http://internal/', { headers: { 'x-forwarded-host': 'app.zebri.com.au', host: 'internal' } }),
      ),
    ).toBe('app.zebri.com.au');
    expect(requestHostOf(new Request('http://internal/', { headers: { host: 'app.zebri.com.au' } }))).toBe(
      'app.zebri.com.au',
    );
    expect(requestHostOf(new Request('http://localhost:3000/api'))).toBe('localhost:3000');
  });

  it('isSameOrigin compares hosts only', () => {
    expect(isSameOrigin('https://app.zebri.com.au', 'app.zebri.com.au')).toBe(true);
    expect(isSameOrigin('http://localhost:3000', 'localhost:3000')).toBe(true);
    expect(isSameOrigin('https://evil.com', 'app.zebri.com.au')).toBe(false);
    expect(isSameOrigin('null', 'app.zebri.com.au')).toBe(false);
  });

  it('isAllowedOrigin is exact match', () => {
    expect(isAllowedOrigin('https://a.com', ['https://a.com'])).toBe(true);
    expect(isAllowedOrigin('https://A.com', ['https://a.com'])).toBe(false);
    expect(isAllowedOrigin('https://a.com', [])).toBe(false);
  });
});

describe('headers', () => {
  it('corsHeaders echoes the exact origin, never credentials', () => {
    const h = corsHeaders('https://a.com');
    expect(h['access-control-allow-origin']).toBe('https://a.com');
    expect(h['vary']).toBe('origin');
    expect(h['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(h['access-control-allow-headers']).toBe('content-type');
    expect(Object.keys(h)).not.toContain('access-control-allow-credentials');
  });

  it('corsHeaders echoes the normalised origin, stripping userinfo', () => {
    const h = corsHeaders('https://evil.com@app.zebri.com.au');
    expect(h['access-control-allow-origin']).toBe('https://app.zebri.com.au');
  });

  it('OPEN_CORS_HEADERS is a read-only wildcard', () => {
    expect(OPEN_CORS_HEADERS['access-control-allow-origin']).toBe('*');
    expect(OPEN_CORS_HEADERS['access-control-allow-methods']).toBe('GET, OPTIONS');
    expect(Object.keys(OPEN_CORS_HEADERS)).not.toContain('access-control-allow-credentials');
  });
});

describe('originOnly / hostOf', () => {
  it('reduces a full URL to its origin and rejects non-http', () => {
    expect(originOnly('https://www.site.com/contact?x=1')).toBe('https://www.site.com');
    expect(originOnly('')).toBeNull();
    expect(originOnly('javascript:alert(1)')).toBeNull();
    expect(originOnly('not a url')).toBeNull();
  });

  it('hostOf shows the host for the UI, falling back to the raw value', () => {
    expect(hostOf('https://www.site.com')).toBe('www.site.com');
    expect(hostOf('garbage')).toBe('garbage');
  });
});

describe('originFromWebsite', () => {
  it.each([
    ['yoursite.com', 'https://yoursite.com'],
    ['https://www.yoursite.com/', 'https://www.yoursite.com'],
    ['http://yoursite.com/contact?x=1', 'http://yoursite.com'],
    ['  WWW.YourSite.com  ', 'https://www.yoursite.com'],
  ])('reads %s as %s', (input, expected) => {
    expect(originFromWebsite(input)).toBe(expected);
  });

  it.each([[''], [null], [undefined], ['localhost'], ['not a url']])(
    'returns null for %s',
    (input) => {
      expect(originFromWebsite(input as string | null | undefined)).toBeNull();
    },
  );
});

describe('withWwwSibling', () => {
  it.each([
    ['https://example.com', ['https://example.com', 'https://www.example.com']],
    ['https://www.example.com', ['https://www.example.com', 'https://example.com']],
    ['http://example.com:3000', ['http://example.com:3000', 'http://www.example.com:3000']],
  ])('pairs %s', (input, expected) => {
    expect(withWwwSibling(input)).toEqual(expected);
  });

  it('leaves a deeper subdomain alone: it is its own site, not an alias', () => {
    expect(withWwwSibling('https://shop.example.com')).toEqual(['https://shop.example.com']);
  });
});
