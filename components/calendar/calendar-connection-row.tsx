/**
 * Single calendar connection row: display + manage one provider's connection.
 *
 * Renders as a flex row with provider/status info on the left and an action
 * button (Connect/Reconnect/Disconnect) on the right. Called by
 * {@link CalendarConnectionsCard} once per provider.
 *
 * @module components/calendar/calendar-connection-row
 */
'use client';

import { AlertCircle, Calendar } from 'lucide-react';

import type { CalendarConnectionSummary } from '@/app/(dashboard)/settings/calendar/actions';
import { Button } from '@/components/ui/button';

/** Human label per provider, shared by every calendar connect surface. */
export const PROVIDER_LABEL: Record<'google' | 'microsoft', string> = {
  google: 'Google Calendar',
  microsoft: 'Outlook Calendar',
};

interface CalendarConnectionRowProps {
  /** The provider this row represents. */
  provider: 'google' | 'microsoft';
  /** The connection state, if any. */
  connection: CalendarConnectionSummary | undefined;
  /** True when a disconnect is in flight. */
  isDisconnecting: boolean;
  /** Called to initiate an OAuth connect flow. */
  onConnect: (provider: 'google' | 'microsoft') => void;
  /** Called to disconnect. */
  onDisconnect: (provider: 'google' | 'microsoft') => void;
}

/**
 * Render one provider's calendar connection: connected with disconnect button,
 * errored with reconnect button, or unconnected with connect button.
 */
export function CalendarConnectionRow({
  provider,
  connection,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: CalendarConnectionRowProps) {
  // Connected state: show email + disconnect button
  if (connection?.status === 'connected') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3 border border-border">
        <span className="flex items-center gap-2 text-body text-text">
          <span className="inline-flex h-2 w-2 rounded-pill bg-success" />
          Connected: {connection.accountEmail}
        </span>
        <Button
          variant="secondary"
          loading={isDisconnecting}
          onClick={() => onDisconnect(provider)}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Error state: show error message + reconnect button
  if (connection?.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3 border border-border">
        <span className="flex items-center gap-2 text-body text-danger">
          <AlertCircle size={16} strokeWidth={1.5} />
          Connection failed. Reconnect to try again.
        </span>
        <Button variant="secondary" onClick={() => onConnect(provider)}>
          Reconnect
        </Button>
      </div>
    );
  }

  // Unconnected state: show provider + connect button
  return (
    <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3 border border-border">
      <span className="flex items-center gap-2 text-body text-text">
        <Calendar size={16} strokeWidth={1.5} className="text-text-muted" />
        {PROVIDER_LABEL[provider]}
      </span>
      <Button variant="outline" onClick={() => onConnect(provider)}>
        Connect
      </Button>
    </div>
  );
}
