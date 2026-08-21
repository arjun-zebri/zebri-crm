/**
 * Viewer timezone detection for the public booking page.
 *
 * The booking page used to render every slot in the MC's zone and store that
 * zone as the booker's, so an interstate couple read the wrong times and got
 * confirmations in a timezone they were never in. Detection is what replaces
 * that guess, so its failure modes matter: it must decline to answer rather
 * than hand back a server zone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectViewerTimezone,
  isValidTimezone,
  timezoneLongLabel,
  zoneOffsetLabel,
} from '@/lib/scheduling/timezone-options';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isValidTimezone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidTimezone('Australia/Perth')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
  });

  it('rejects empty, non-string and unknown zones', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
    expect(isValidTimezone(42)).toBe(false);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
  });
});

/**
 * Make the argument-less `Intl.DateTimeFormat()` report `zone`, while any call
 * that passes a `timeZone` still uses the real constructor.
 *
 * Mocking the constructor wholesale would also stub the validity check inside
 * `detectViewerTimezone`, so a bogus zone would sail through and the test
 * would pass for the wrong reason.
 */
function stubBrowserZone(zone: string) {
  const Original = Intl.DateTimeFormat;
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) =>
    options?.timeZone
      ? new Original(locales, options)
      : { resolvedOptions: () => ({ timeZone: zone }) }) as unknown as typeof Intl.DateTimeFormat);
}

describe('detectViewerTimezone', () => {
  it('returns the browser zone when the runtime reports one', () => {
    stubBrowserZone('Australia/Perth');

    expect(detectViewerTimezone()).toBe('Australia/Perth');
  });

  it('returns null rather than a bogus zone the runtime cannot format', () => {
    stubBrowserZone('Nowhere/Nothing');

    // Why: callers fall back deliberately. Returning a zone that cannot be
    // formatted would throw later, deep inside slot rendering.
    expect(detectViewerTimezone()).toBeNull();
  });

  it('returns null on the server instead of leaking the host zone', () => {
    vi.stubGlobal('window', undefined);
    // Why: on Vercel the server zone is UTC, which is nobody's timezone.
    // Seeding from it would silently present UTC as the booker's own.
    expect(detectViewerTimezone()).toBeNull();
  });
});

describe('zone labels', () => {
  it('gives an offset for a known zone', () => {
    expect(zoneOffsetLabel('Australia/Sydney')).toMatch(/GMT[+-]\d/);
  });

  it('falls back to the raw id for an unknown zone', () => {
    expect(zoneOffsetLabel('Mars/Olympus_Mons')).toBe('');
    expect(timezoneLongLabel('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons');
  });
});
