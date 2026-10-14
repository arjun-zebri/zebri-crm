/**
 * Pure time formatting for the public booking page.
 *
 * Every string a booker reads about a slot comes from here: the day header,
 * the time buttons, the summary, the confirmation and the "that's 9:30am in
 * Sydney" hint. Keeping them in one place means a booking reads the same
 * everywhere it appears.
 *
 * The locale is the booker's own (`navigator.language`), because they read
 * the times and the browser already knows their conventions. It falls back
 * to `en-AU` because Zebri's MCs are Australian and that is the house style:
 * `10:30–11:00am AEDT`, with the zone name always shown so a time never
 * reads as ambiguous.
 *
 * @module lib/booking/format-time
 */

/** Locale used when the browser's language is missing or unusable. */
export const FALLBACK_LOCALE = 'en-AU';

/**
 * Locales that write the period as lowercase `am`/`pm` glued to the time
 * (`10:30am`). Everywhere else Intl's own spacing is kept (`10:30 AM`).
 */
const COMPACT_PERIOD_LOCALES = /^en-(AU|NZ)$/;

/**
 * Pick the locale to format with. Returns `en-AU` for an empty, malformed
 * or unsupported tag, so a bad browser setting never throws a RangeError.
 *
 * @param navigatorLanguage - `navigator.language`, or undefined on the server
 */
export function pickLocale(navigatorLanguage: string | null | undefined): string {
  if (!navigatorLanguage) return FALLBACK_LOCALE;
  try {
    const [canonical] = Intl.getCanonicalLocales(navigatorLanguage);
    return canonical ?? FALLBACK_LOCALE;
  } catch {
    return FALLBACK_LOCALE;
  }
}

/** Parts of a formatted time, pulled out so the range can be assembled. */
interface TimeParts {
  hour: string;
  minute: string;
  period: string | null;
  zone: string | null;
}

function timeParts(date: Date, timezone: string, locale: string, withZone: boolean): TimeParts {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    ...(withZone ? { timeZoneName: 'short' as const } : {}),
  });
  const parts: TimeParts = { hour: '', minute: '', period: null, zone: null };
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'hour') parts.hour = part.value;
    else if (part.type === 'minute') parts.minute = part.value;
    else if (part.type === 'dayPeriod') parts.period = part.value;
    else if (part.type === 'timeZoneName') parts.zone = part.value;
  }
  return parts;
}

/** Joins a period onto a time, with or without the space the locale uses. */
function withPeriod(time: string, period: string | null, locale: string): string {
  if (!period) return time;
  const glue = COMPACT_PERIOD_LOCALES.test(locale) ? '' : ' ';
  return `${time}${glue}${period}`;
}

/**
 * A slot's start as a short time, e.g. `10:30am`. Used on the mobile summary
 * bar and the MC hint.
 *
 * @param iso - the slot instant
 * @param timezone - the zone to show the time in
 * @param locale - the booker's locale (see {@link pickLocale})
 */
export function formatTimeOfDay(iso: string, timezone: string, locale: string): string {
  const parts = timeParts(new Date(iso), timezone, locale, false);
  return withPeriod(`${parts.hour}:${parts.minute}`, parts.period, locale);
}

/**
 * A time range with the zone name, e.g. `10:30–11:00am AEDT`.
 *
 * The period is written once when both ends share it, the way a person
 * would say it aloud. When the end falls on a later local day, the end time
 * still reads correctly because the date is shown by {@link formatBookingDate}.
 *
 * @param startIso - the slot start
 * @param endIso - the slot end
 * @param timezone - the zone to show the times in
 * @param locale - the booker's locale
 */
export function formatTimeRange(
  startIso: string,
  endIso: string,
  timezone: string,
  locale: string,
): string {
  const start = timeParts(new Date(startIso), timezone, locale, false);
  const end = timeParts(new Date(endIso), timezone, locale, false);
  const samePeriod = start.period === end.period;
  const startText = `${start.hour}:${start.minute}`;
  const startWithPeriod = samePeriod ? startText : withPeriod(startText, start.period, locale);
  const endWithPeriod = withPeriod(`${end.hour}:${end.minute}`, end.period, locale);
  return `${startWithPeriod}–${endWithPeriod} ${zoneLabel(new Date(endIso), timezone, locale)}`;
}

/** True for an offset-style name like `GMT+11` or `UTC−5`, which says nothing to a reader. */
const OFFSET_NAME = /^(GMT|UTC)[+\-−]/;

function shortZoneName(date: Date, timezone: string, locale: string): string | null {
  const part = new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? null;
}

/**
 * A zone name a person recognises: `AEDT`, `PST`, or failing those `Sydney time`.
 *
 * Intl only knows the abbreviations its locale data uses, so an en-US browser
 * reading a Sydney time gets `GMT+11`, which nobody says. The en-AU data is
 * tried next because Zebri's zones are mostly Australian and it knows their
 * names; anything still offset-shaped falls back to the zone's city.
 *
 * @param date - the instant, since the name changes with daylight saving
 * @param timezone - an IANA zone name
 * @param locale - the booker's locale
 */
export function zoneLabel(date: Date, timezone: string, locale: string): string {
  for (const l of [locale, FALLBACK_LOCALE]) {
    const name = shortZoneName(date, timezone, l);
    if (name && !OFFSET_NAME.test(name)) return name;
  }
  return `${cityFromTimezone(timezone)} time`;
}

/**
 * The day of a slot in full, e.g. `Wednesday 14 October`.
 *
 * @param iso - the slot instant
 * @param timezone - the zone the day is read in
 * @param locale - the booker's locale
 */
export function formatBookingDate(iso: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(new Date(iso));
}

/**
 * A short day for the mobile summary bar, e.g. `Wed 14 Oct`.
 *
 * @param iso - the slot instant
 * @param timezone - the zone the day is read in
 * @param locale - the booker's locale
 */
export function formatShortDate(iso: string, timezone: string, locale: string): string {
  // Joined from the parts rather than trusting Intl's punctuation: en-AU puts
  // a comma after the weekday, and the summary bar is meant to read as words.
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).formatToParts(new Date(iso));
  return parts
    .filter((p) => p.type === 'weekday' || p.type === 'day' || p.type === 'month')
    .map((p) => p.value)
    .join(' ');
}

/**
 * The whole booking in one line: `Wednesday 14 October · 10:30–11:00am AEDT`.
 *
 * @param startIso - the slot start
 * @param endIso - the slot end
 * @param timezone - the zone to show the booking in
 * @param locale - the booker's locale
 */
export function formatBookingWhen(
  startIso: string,
  endIso: string,
  timezone: string,
  locale: string,
): string {
  return `${formatBookingDate(startIso, timezone, locale)} · ${formatTimeRange(startIso, endIso, timezone, locale)}`;
}

/**
 * The mobile summary bar: `Wed 14 Oct · 10:30am`.
 *
 * @param iso - the slot instant
 * @param timezone - the zone to show the booking in
 * @param locale - the booker's locale
 */
export function formatSummaryWhen(iso: string, timezone: string, locale: string): string {
  return `${formatShortDate(iso, timezone, locale)} · ${formatTimeOfDay(iso, timezone, locale)}`;
}

/**
 * The city an IANA zone is named after: `Australia/Sydney` becomes `Sydney`,
 * and `America/Port_of_Spain` becomes `Port of Spain`.
 *
 * @param timezone - an IANA zone name
 */
export function cityFromTimezone(timezone: string): string {
  const last = timezone.split('/').pop() ?? timezone;
  return last.replace(/_/g, ' ');
}

/**
 * The hint shown when the booker reads times in a different zone from the MC:
 * `That's 9:30am in Sydney.` Returns null when the zones match, or when the
 * MC's zone is not known yet, so no hint appears rather than a wrong one.
 *
 * @param iso - the slot instant
 * @param bookerTimezone - the zone the booker is reading in
 * @param mcTimezone - the MC's zone
 * @param locale - the booker's locale
 */
export function formatMcHint(
  iso: string,
  bookerTimezone: string,
  mcTimezone: string,
  locale: string,
): string | null {
  if (!mcTimezone || mcTimezone === bookerTimezone) return null;
  const time = formatTimeOfDay(iso, mcTimezone, locale);
  return `That's ${time} in ${cityFromTimezone(mcTimezone)}.`;
}
