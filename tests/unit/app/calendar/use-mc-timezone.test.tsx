/**
 * Which timezone the dashboard draws the MC's calendar on.
 *
 * Regression: every grid surface inlined `availability?.timezone || 'UTC'`.
 * `user_public_settings.timezone` is nullable with no default and nothing
 * seeds it at signup, so a brand-new MC got a UTC clock — ten hours off in
 * Sydney — while the Availability tab showed them their browser zone and made
 * the setting look correct.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useMcTimezone } from '@/app/(dashboard)/calendar/use-mc-timezone';

const availability = vi.fn();
const browserTimezone = vi.fn();

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => availability(),
}));

vi.mock('@/components/scheduling/use-browser-timezone', () => ({
  useBrowserTimezone: () => browserTimezone(),
}));

beforeEach(() => {
  availability.mockReset();
  browserTimezone.mockReset().mockReturnValue('Australia/Sydney');
});

describe('useMcTimezone', () => {
  it('uses the zone the MC saved', () => {
    availability.mockReturnValue({ data: { timezone: 'Europe/London' } });
    const { result } = renderHook(() => useMcTimezone());
    expect(result.current).toBe('Europe/London');
  });

  it('falls back to the browser zone for an MC who has never saved one', () => {
    // The reported bug: a new user's timezone column is null.
    availability.mockReturnValue({ data: { timezone: null } });
    const { result } = renderHook(() => useMcTimezone());
    expect(result.current).toBe('Australia/Sydney');
    expect(result.current).not.toBe('UTC');
  });

  it('falls back to the browser zone while availability is still loading', () => {
    availability.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useMcTimezone());
    expect(result.current).toBe('Australia/Sydney');
  });

  it('only reaches UTC when the browser cannot say either', () => {
    availability.mockReturnValue({ data: { timezone: null } });
    browserTimezone.mockReturnValue('');
    const { result } = renderHook(() => useMcTimezone());
    expect(result.current).toBe('UTC');
  });
});
