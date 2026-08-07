/**
 * Compact status panel that surfaces what Stripe is telling us about
 * the connected MC account — capability flags (charges + payouts),
 * masked account ID, requirements list, and the `disabled_reason` if
 * the account has been paused.
 *
 * Embeds inside the settings → payments tab above the `<ConnectAccount
 * Management>` component. Stripe's own `<ConnectNotificationBanner>`
 * also fires for action-required cases, but the panel is the always-
 * on Zebri-side summary the MC sees at a glance.
 *
 * Pure presentation — the parent owns the data fetch from
 * `/api/stripe/connect/status`.
 *
 * @module components/settings/connect-status-panel
 */
'use client';

import { CheckCircle, Clock, Loader2, OctagonAlert, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { ConnectAccountState } from '@/lib/payments/connect-account';

export interface ConnectStatusPanelProps {
  state: ConnectAccountState;
  /** Trigger from the parent so disconnect/refresh actions can hook. */
  onDisconnect?: () => void;
  disconnecting?: boolean;
  /** Pull fresh state from Stripe + write to mirror. Manual escape
   *  hatch for local-dev setups without webhook forwarding, and a
   *  general "give me the latest" button for everyone else. */
  onSync?: () => Promise<void> | void;
}

export function ConnectStatusPanel({
  state,
  onDisconnect,
  disconnecting,
  onSync,
}: ConnectStatusPanelProps) {
  const [syncing, setSyncing] = useState(false);
  async function handleSync() {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  }
  const maskedId = state.accountId
    ? `${state.accountId.slice(0, 8)}…${state.accountId.slice(-4)}`
    : '—';
  const hasRequirements =
    state.requirementsCurrentlyDue.length > 0 ||
    state.requirementsPastDue.length > 0;

  return (
    <div className="rounded-control border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body text-text">
          {state.chargesEnabled ? (
            <CheckCircle size={16} strokeWidth={1.5} className="text-success" />
          ) : (
            <Clock size={16} strokeWidth={1.5} className="text-text-muted" />
          )}
          <span className="font-medium">
            {state.chargesEnabled ? 'Charges enabled' : 'Onboarding in progress'}
          </span>
          <span className="text-body text-text-subtle">· {maskedId}</span>
        </div>
        <div className="flex items-center gap-3">
          {onSync ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              aria-label="Refresh status from Stripe"
              title="Refresh status from Stripe"
              className="inline-flex items-center gap-1 text-body text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-50"
            >
              {/* The icon carries the in-flight state; the label does
                  not change, so the row never reflows mid-action. */}
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={syncing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          ) : null}
          {onDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnecting}
              aria-busy={disconnecting || undefined}
              className="inline-flex items-center gap-1 text-body text-text-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
            >
              {disconnecting ? (
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              ) : null}
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-body">
        <CapabilityRow
          label="Charges"
          enabled={state.chargesEnabled}
        />
        <CapabilityRow
          label="Payouts"
          enabled={state.payoutsEnabled}
        />
      </div>

      {state.disabledReason ? (
        <div className="flex items-start gap-2 rounded-control bg-danger/5 border border-danger/30 p-2.5">
          <OctagonAlert
            size={16}
            strokeWidth={1.5}
            className="text-danger shrink-0 mt-0.5"
          />
          <div className="text-body text-text">
            <p className="font-medium">Account paused by Stripe</p>
            <p className="text-text-muted">
              Reason: <span className="font-mono">{state.disabledReason}</span>.
              Complete the requirements below to re-enable card payments.
            </p>
          </div>
        </div>
      ) : null}

      {hasRequirements ? (
        <div className="text-body">
          <p className="font-medium text-text mb-1">
            Stripe needs additional information
          </p>
          <ul className="list-disc list-inside text-text-muted space-y-0.5">
            {state.requirementsPastDue.map((r) => (
              <li key={`pd-${r}`} className="text-danger">
                {humaniseRequirement(r)} <span className="text-danger/70">(overdue)</span>
              </li>
            ))}
            {state.requirementsCurrentlyDue.map((r) => (
              <li key={`cd-${r}`}>{humaniseRequirement(r)}</li>
            ))}
          </ul>
          <p className="mt-2 text-text-subtle">
            Use the onboarding form below to provide this — Stripe handles the
            actual verification.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CapabilityRow({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-pill ${
          enabled ? 'bg-success' : 'bg-text-subtle'
        }`}
      />
      <span className="text-text-muted">{label}</span>
      <span className={enabled ? 'text-success font-medium' : 'text-text-subtle'}>
        {enabled ? 'enabled' : 'pending'}
      </span>
    </div>
  );
}

/**
 * Stripe sends requirement field names like
 * "individual.dob.day" or "business_profile.url". They're readable
 * but ugly — quick humanisation so the list doesn't look like a
 * schema dump.
 */
function humaniseRequirement(field: string): string {
  return field
    .split('.')
    .map((segment) => segment.replace(/_/g, ' '))
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(' → ');
}
