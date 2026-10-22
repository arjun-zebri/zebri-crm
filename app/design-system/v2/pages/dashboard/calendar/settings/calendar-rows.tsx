'use client';

import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { SiGooglecalendar } from 'react-icons/si';

import { ConnectSourceRow } from '../../enquiries/settings/pane-parts';
import type { CalendarSource } from '../calendar-data';
import { useCalendarSync } from '../use-calendar-sync';

/**
 * Google Calendar and Outlook as connect rows (`ConnectSourceRow`, the
 * Enquiries tab's inbox rows; Google Calendar's one mark, `SiGooglecalendar`): Connect until connected, then the account
 * and Disconnect, handing over in place. One connection serves every
 * block that needs a calendar, so Settings' Calendar and Booking links
 * tabs both show these same rows. Simulated.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/settings/calendar-rows
 */

const CALENDARS: { id: CalendarSource; name: string; icon: typeof SiGooglecalendar; color: string; as: string }[] = [
  { id: 'google', name: 'Google Calendar', icon: SiGooglecalendar, color: '#4285F4', as: 'hello@arjunpunekarmc.com.au' },
  { id: 'outlook', name: 'Outlook', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4', as: 'arjun.punekar@outlook.com' },
];

/** The connect rows. See the module comment. */
export function CalendarRows() {
  const sync = useCalendarSync();
  return (
    <div className="space-y-2">
      {CALENDARS.map((c) => {
        return (
          <ConnectSourceRow
            key={c.id}
            icon={c.icon}
            color={c.color}
            name={c.name}
            as={c.as}
            on={sync.connected.has(c.id)}
            busy={sync.connecting === c.id}
            locked={sync.connecting !== null}
            onConnect={() => sync.connect(c.id)}
            onDisconnect={() => sync.disconnect(c.id)}
          />
        );
      })}
    </div>
  );
}
