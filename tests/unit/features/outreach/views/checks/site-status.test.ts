// tests/unit/features/outreach/views/checks/site-status.test.ts
/**
 * Website results shown to the founder. Raw enums must never reach the
 * screen, and imported text must never become a link unless it is http(s).
 */
import { describe, expect, it } from 'vitest';

import { formatUsd } from '@/features/outreach/views/checks/format';
import { httpUrlOrNull, siteStatusLabel } from '@/features/outreach/views/checks/site-status';

describe('siteStatusLabel', () => {
  it('maps every stored outcome to a plain label, never the raw enum', () => {
    expect(siteStatusLabel('dead_dns')).toBe("Domain doesn't exist");
    expect(siteStatusLabel('http_error')).toBe('Site returned an error');
    expect(siteStatusLabel('no_site')).toBe('No website found');
    expect(siteStatusLabel('live')).toBe('Site is live');
    expect(siteStatusLabel('parked')).toBe('Parked domain, no real site');
    expect(siteStatusLabel('timeout')).toBe("Site didn't respond in time");
    expect(siteStatusLabel('blocked')).toBe('Site blocked the check');
  });

  it('says "Not checked" for null and keeps unknown values visible', () => {
    expect(siteStatusLabel(null)).toBe('Not checked');
    expect(siteStatusLabel('something_new')).toBe('something_new');
  });
});

describe('httpUrlOrNull', () => {
  it('returns absolute http and https URLs', () => {
    expect(httpUrlOrNull('https://example.com.au/weddings')).toBe('https://example.com.au/weddings');
    expect(httpUrlOrNull('http://example.com')).toBe('http://example.com/');
  });

  it('rejects text that is not a URL, and non-web schemes', () => {
    expect(httpUrlOrNull('see our page')).toBeNull();
    expect(httpUrlOrNull('example.com')).toBeNull();
    expect(httpUrlOrNull('javascript:alert(1)')).toBeNull();
    expect(httpUrlOrNull('mailto:jane@example.com')).toBeNull();
    expect(httpUrlOrNull('')).toBeNull();
    expect(httpUrlOrNull(null)).toBeNull();
  });
});

describe('formatUsd', () => {
  it('prefixes US$ to match the USD budget in Settings', () => {
    expect(formatUsd(1250)).toBe('US$12.50');
    expect(formatUsd(0)).toBe('US$0.00');
  });
});
