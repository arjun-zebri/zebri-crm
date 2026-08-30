/**
 * Unit tests for the user-agent summary that lands in a ticket's
 * "Notes for the implementer" section.
 */
import { describe, expect, it } from 'vitest';

import { summariseUserAgent } from '@/lib/bug-reports/user-agent';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

describe('summariseUserAgent', () => {
  it('reads Chrome on macOS', () => {
    expect(summariseUserAgent(CHROME_MAC)).toBe('Chrome 141 on macOS');
  });

  it('prefers Edge over the Chrome token it also carries', () => {
    expect(summariseUserAgent(EDGE_WINDOWS)).toBe('Edge 141 on Windows');
  });

  it('reads Safari on iOS, not the Mac OS X it claims', () => {
    expect(summariseUserAgent(SAFARI_IOS)).toBe('Safari 17 on iOS');
  });

  it('reads Firefox on Linux', () => {
    expect(summariseUserAgent(FIREFOX_LINUX)).toBe('Firefox 130 on Linux');
  });

  it('says unknown when the header is absent', () => {
    expect(summariseUserAgent(null)).toBe('unknown');
  });

  it('falls back to the raw string rather than guessing', () => {
    expect(summariseUserAgent('SomeCrawler/2.0')).toBe('SomeCrawler/2.0');
  });
});
