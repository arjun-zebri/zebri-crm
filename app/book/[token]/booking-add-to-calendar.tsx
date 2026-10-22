/**
 * "Add to calendar" for a confirmed booking: Google and Outlook open a
 * prefilled event, and everything else (Apple Calendar in particular) gets an
 * `.ics` file. The builders live in `lib/booking/calendar-links`; this file
 * only wires them to links and the download.
 *
 * @module app/book/[token]/booking-add-to-calendar
 */
'use client'

import { Button, buttonClassName } from '@/components/ui/button'
import {
  buildEventUid,
  buildGoogleCalendarUrl,
  buildIcs,
  buildOutlookCalendarUrl,
  type CalendarEvent,
} from '@/lib/booking/calendar-links'

export interface BookingAddToCalendarProps {
  /** The booking as a calendar event. */
  event: CalendarEvent;
}

/** Downloads `content` as a file. Revokes the object URL once the click has landed. */
function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // A revoke in the same tick can cancel the download in Safari, so wait a beat.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Three ways to add the booking, one of which is a file download. */
export function BookingAddToCalendar({ event }: BookingAddToCalendarProps) {
  const google = buildGoogleCalendarUrl(event);
  const outlook = buildOutlookCalendarUrl(event);

  function downloadIcs() {
    const ics = buildIcs({ ...event, uid: buildEventUid(event.start, event.title) });
    downloadFile('booking.ics', ics, 'text/calendar;charset=utf-8');
  }

  return (
    <div className="space-y-3">
      <p className="text-body font-medium text-text">Add to calendar</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={google}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: 'outline' })}
        >
          Google
        </a>
        <a
          href={outlook}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: 'outline' })}
        >
          Outlook
        </a>
        <Button variant="outline" onClick={downloadIcs}>
          Apple or other (.ics)
        </Button>
      </div>
    </div>
  );
}
