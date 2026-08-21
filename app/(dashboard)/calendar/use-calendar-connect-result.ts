/**
 * Surface the outcome of a calendar OAuth round trip that returned to
 * `/calendar`.
 *
 * The callback appends `?calendar=connected|error`; this reads it once, toasts,
 * refreshes the shared connection cache so the banner and tab notices clear
 * immediately, then strips the param so a reload cannot re-toast.
 *
 * @module app/(dashboard)/calendar/use-calendar-connect-result
 */
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { CALENDAR_CONNECTIONS_KEY } from '@/components/calendar/use-calendar-connections';
import { useToast } from '@/components/ui/toast';

/** Read, announce and clear the `?calendar=` result param. */
export function useCalendarConnectResult() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // The effect re-runs on every params identity change; this pins the toast to
  // the first pass so a re-render cannot show it twice.
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

    // Strip shallowly: a router push would remount the page and throw away the
    // tab the MC was on when they left for the consent screen.
    window.history.replaceState(null, '', '/calendar');
  }, [searchParams, queryClient, toast]);
}
