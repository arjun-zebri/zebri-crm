/**
 * Calendar connections subsection of the Public Page settings.
 *
 * Lets an MC connect their Google Calendar or Outlook Calendar for
 * availability checking and booking conflict detection. Connecting is the
 * OAuth redirect flow; this component drives the list display and disconnect,
 * and shows the post-redirect result. Available on every plan.
 *
 * The list itself comes from the shared {@link useCalendarConnections} cache so
 * this card and the `/calendar` banner can never disagree about whether a
 * calendar is connected.
 *
 * @module app/(dashboard)/settings/calendar-connections-card
 */
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CalendarConnectionRow } from '@/components/calendar/calendar-connection-row';
import { calendarConnectUrl } from '@/components/calendar/connect-url';
import {
  CALENDAR_CONNECTIONS_KEY,
  CALENDAR_PROVIDERS,
  useCalendarConnections,
  type CalendarProvider,
} from '@/components/calendar/use-calendar-connections';
import { useToast } from '@/components/ui/toast';

import { disconnectCalendarAction } from './calendar/actions';

/**
 * Calendar connections card: displays current connections and allows
 * connecting/disconnecting. Reads the OAuth callback result from query params
 * and toasts the outcome once.
 */
export function CalendarConnectionsCard() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { connections, isLoading, error } = useCalendarConnections();
  const [disconnecting, setDisconnecting] = useState<CalendarProvider | null>(null);

  // Surface the result of the OAuth round-trip once, then strip the param.
  const toastedRef = useRef(false);
  useEffect(() => {
    const result = searchParams.get('calendar');
    if (!result || toastedRef.current) return;
    toastedRef.current = true;
    if (result === 'connected') {
      toast('Calendar connected.');
      queryClient.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
    } else if (result === 'error') {
      toast('Could not connect that calendar. Please try again.', 'error');
    }
    // Strip the param shallowly to avoid remounting the modal.
    window.history.replaceState(null, '', '/settings?tab=public');
  }, [searchParams, queryClient, toast]);

  // The query throws its error rather than returning it, so surface it once
  // instead of rendering an empty list that looks like "nothing connected".
  useEffect(() => {
    if (error) toast(error instanceof Error ? error.message : String(error), 'error');
  }, [error, toast]);

  const connect = (provider: CalendarProvider) => {
    window.location.assign(calendarConnectUrl(provider, 'settings'));
  };

  const disconnect = async (provider: CalendarProvider) => {
    setDisconnecting(provider);
    const result = await disconnectCalendarAction(provider);
    setDisconnecting(null);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: CALENDAR_CONNECTIONS_KEY });
      toast(`${provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'} disconnected.`);
    } else {
      toast(result.error, 'error');
    }
  };

  const heading = (
    <>
      <h3 className="text-body font-medium text-text mb-1">Calendars</h3>
      <p className="text-body text-text-muted mb-3">
        Connect your calendar so bookings never clash with what&apos;s already on it.
      </p>
    </>
  );

  if (isLoading) {
    return (
      <div>
        {heading}
        <div className="space-y-2 max-w-xl">
          <div className="h-12 rounded-control bg-surface-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {heading}

      <div className="space-y-2 max-w-xl">
        {CALENDAR_PROVIDERS.map((provider) => (
          <CalendarConnectionRow
            key={provider}
            provider={provider}
            connection={connections.find((c) => c.provider === provider)}
            isDisconnecting={disconnecting === provider}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        ))}
      </div>
    </div>
  );
}
