/**
 * User-agent prettifying for the certificate (`lib/contracts/user-agent`).
 *
 * Order matters in the browser detection: Edge and Chrome both claim "Chrome",
 * and Chrome claims "Safari", so the cases below pin the precedence.
 */
import { describe, expect, it } from 'vitest'

import { describeUserAgent } from '@/lib/contracts/user-agent'

describe('describeUserAgent', () => {
  it('reads Chrome on macOS', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 141 on macOS')
  })

  it('reads Safari on iOS rather than mistaking it for Chrome', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 17 on iOS')
  })

  it('prefers Edge over the Chrome token it also carries', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toBe('Edge 141 on Windows')
  })

  it('reads Firefox on Android', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0'),
    ).toBe('Firefox 130 on Android')
  })

  it('returns the platform alone when the browser is unrecognised', () => {
    expect(describeUserAgent('SomeBot/1.0 (Windows NT 10.0)')).toBe('Windows')
  })

  it('says nothing rather than printing a wall of tokens', () => {
    expect(describeUserAgent('curl/8.4.0')).toBeNull()
    expect(describeUserAgent('')).toBeNull()
    expect(describeUserAgent(null)).toBeNull()
    expect(describeUserAgent(undefined)).toBeNull()
    expect(describeUserAgent('   ')).toBeNull()
  })
})
