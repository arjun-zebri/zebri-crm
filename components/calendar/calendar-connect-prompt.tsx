/**
 * Inline "connect a calendar" affordances shared by the Settings card, the
 * `/calendar` banner and the per-tab notices.
 *
 * Prompts deliberately state a consequence rather than an instruction: the MC
 * is not blocked by a missing connection, so the prompt has to earn the click
 * by naming what they lose. Each call site supplies its own `message` because
 * the cost differs by surface (an incomplete grid vs a missing video link).
 *
 * @module components/calendar/calendar-connect-prompt
 */
'use client';

import { CalendarPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PROVIDER_LABEL } from './calendar-connection-row';
import { calendarConnectUrl, type CalendarConnectReturnTo } from './connect-url';
import { CALENDAR_PROVIDERS, type CalendarProvider } from './use-calendar-connections';

interface CalendarConnectButtonsProps {
  /** Where the OAuth round trip should land the MC afterwards. */
  returnTo: CalendarConnectReturnTo;
}

/**
 * One connect button per supported provider.
 *
 * Navigates with a full page load rather than the router: the authorize route
 * sets httpOnly cookies and 302s to a third-party origin, which a client-side
 * transition cannot follow.
 */
export function CalendarConnectButtons({ returnTo }: CalendarConnectButtonsProps) {
  const connect = (provider: CalendarProvider) => {
    window.location.assign(calendarConnectUrl(provider, returnTo));
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {CALENDAR_PROVIDERS.map((provider) => (
        <Button key={provider} variant="outline" onClick={() => connect(provider)}>
          {PROVIDER_LABEL[provider]}
        </Button>
      ))}
    </div>
  );
}

interface CalendarConnectNoteProps {
  /** The consequence of staying unconnected, phrased for this surface. */
  message: string;
}

/**
 * A quiet one-line note explaining what a tab is missing without a calendar.
 *
 * Deliberately carries no buttons and no box. Every surface that uses it sits
 * under the route banner, which already offers both providers a few pixels
 * above; repeating the pair here put two identical button rows on screen at
 * once and made the page shout. The note's job is to explain *this* surface's
 * gap, and let the banner own the action.
 */
export function CalendarConnectNote({ message }: CalendarConnectNoteProps) {
  return (
    <p className="flex items-start gap-2 text-body text-text-subtle" role="status">
      <CalendarPlus size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
