/**
 * IANA timezone list + viewer detection, shared by every timezone picker.
 *
 * Pure functions, no React. The MC's availability picker and the public
 * booking page both need the same searchable zone list, so it lives here
 * rather than being duplicated per surface.
 *
 * @module lib/scheduling/timezone-options
 */

/** One searchable zone: the IANA id plus what a person actually reads. */
export interface ZoneOption {
  id: string;
  /** `Australia/Sydney` rendered as `Australia · Sydney`. */
  label: string;
  /** Current UTC offset, e.g. `GMT+10`. */
  offset: string;
  /** Lower-cased haystack for the search box. */
  search: string;
}

/** Used where the runtime cannot enumerate zones, and as a last-resort zone. */
const FALLBACK_ZONES = ['Etc/UTC', 'America/New_York', 'Europe/London', 'Australia/Sydney'];

/**
 * Every IANA zone the runtime knows, decorated for display and search.
 *
 * Falls back to a short list where `Intl.supportedValuesOf` is missing.
 */
export function buildZoneOptions(): ZoneOption[] {
  let ids: string[];
  try {
    ids = [...Intl.supportedValuesOf('timeZone')];
  } catch {
    ids = FALLBACK_ZONES;
  }

  return ids.map((id) => {
    const label = id.replace(/_/g, ' ').replace(/\//g, ' · ');
    return {
      id,
      label,
      offset: zoneOffsetLabel(id),
      search: `${label} ${id}`.toLowerCase(),
    };
  });
}

/**
 * Current UTC offset for a zone, e.g. `GMT+10`.
 *
 * Read from `Intl` rather than stored, so daylight saving is always whatever
 * is true today. Returns an empty string on zones the runtime cannot format
 * rather than breaking the row.
 */
export function zoneOffsetLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/** Whether the runtime accepts `timeZone` as a formattable IANA zone. */
export function isValidTimezone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone === '') return false;
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone the person reading the page is in, per their own browser.
 *
 * Returns `null` on the server and wherever `Intl` cannot say, so callers
 * decide the fallback rather than silently inheriting a server zone: on
 * Vercel that would be UTC, which is nobody's actual timezone.
 */
export function detectViewerTimezone(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimezone(detected) ? detected : null;
  } catch {
    return null;
  }
}

/**
 * A zone's long name for display, e.g. `Australian Eastern Standard Time`.
 *
 * Falls back to the raw id so an unknown zone still reads as something.
 */
export function timezoneLongLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone,
      timeZoneName: 'long',
    }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
