/**
 * Add-to-calendar builders for a confirmed booking.
 *
 * Three outputs: a Google Calendar template URL, an Outlook web compose URL,
 * and an iCalendar (`.ics`) document for Apple Calendar and everything else.
 * All of them are pure string builders so they can be unit tested without a
 * browser. The download itself (a Blob and an anchor click) lives in the
 * component, because it touches the DOM.
 *
 * Times are always written in UTC, so a calendar app places the event at the
 * right instant whatever zone the booker or the MC is in.
 *
 * @module lib/booking/calendar-links
 */

/** The facts about a booking that every calendar format needs. */
export interface CalendarEvent {
  /** Event title, e.g. `Consultation with Lemon Weddings`. */
  title: string;
  /** Slot start as an ISO 8601 instant. */
  start: string;
  /** Slot end as an ISO 8601 instant. */
  end: string;
  /** Free text for the event body. Optional. */
  description?: string | undefined;
  /** Where it happens: an address, or a join link for a video call. */
  location?: string | undefined;
  /** A link to open the meeting. Optional, shown in the ICS `URL` field. */
  url?: string | undefined;
}

/** Event for `.ics` output: {@link CalendarEvent} plus the stable UID. */
export interface IcsEvent extends CalendarEvent {
  /** Identifier calendar apps use to recognise the same event twice. */
  uid: string;
  /** Stamp of when the file was made. Defaults to now; pass it in tests. */
  now?: Date;
}

/**
 * An ISO instant as a basic-format UTC stamp, `20261014T003000Z`.
 * Google and iCalendar both want this form.
 *
 * @param iso - an ISO 8601 instant
 * @throws RangeError when `iso` is not a valid date
 */
export function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date: ${iso}`);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * A Google Calendar "create event" link. Opening it shows a prefilled event
 * the booker saves with one click.
 *
 * @param event - the booking to add
 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(event.end)}`,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * An Outlook on the web "compose event" link. Outlook takes ISO instants
 * directly, so no reformatting is needed.
 *
 * @param event - the booking to add
 */
export function buildOutlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(event.end).toISOString(),
  });
  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Escape a value for an iCalendar TEXT property (RFC 5545 section 3.3.11).
 *
 * Backslash goes first so the escapes added for `;`, `,` and newlines are
 * not themselves escaped. Without this a description containing a comma or a
 * line break corrupts the event or splits it into fields the calendar ignores.
 *
 * @param value - raw text from the booking
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold one content line to 75 octets (RFC 5545 section 3.1). A line longer
 * than that is split, and each continuation starts with a single space. The
 * split never cuts a multi-byte character in half, because a broken code
 * point is what makes calendar apps reject the whole file.
 *
 * @param line - one unfolded content line, without its line ending
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  // The first line may carry 75 octets; continuations spend one on the space.
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      chunks.push(current);
      current = '';
      bytes = 0;
      limit = 74;
    }
    current += ch;
    bytes += size;
  }
  chunks.push(current);
  return chunks.join('\r\n ');
}

/**
 * Build an iCalendar document for one booking. Lines end in CRLF, which is
 * what the spec requires and what strict importers check for.
 *
 * @param event - the booking, with the UID the calendar uses to dedupe
 */
export function buildIcs(event: IcsEvent): string {
  const stamp = toUtcStamp((event.now ?? new Date()).toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zebri//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtcStamp(event.start)}`,
    `DTEND:${toUtcStamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeIcsText(event.url)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * A UID that is the same every time this booking is exported, so importing
 * the file twice updates one event instead of making a duplicate. It is
 * derived from the start instant and the title; it is not a secret.
 *
 * @param start - the slot start as an ISO instant
 * @param seed - anything that tells two bookings at the same time apart
 */
export function buildEventUid(start: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  return `${toUtcStamp(start)}-${hash.toString(36)}@zebri`;
}
