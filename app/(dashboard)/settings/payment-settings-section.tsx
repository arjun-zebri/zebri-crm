/**
 * Settings → Payments tab.
 *
 * Two sections:
 *
 * 1. **Bank details** — auto-filled into invoice notes. Stored in
 *    `user_metadata` (not trust-level entitlement data — safe to be
 *    user-writable).
 *
 * 2. **Card payments via Stripe Connect** — Phase 2D.1 redesign.
 *    Replaces the old "Connect Stripe" → redirect-to-Stripe flow
 *    with Stripe's embedded Connect components rendered inline.
 *
 *    Flow:
 *    - First time → "Set up card payments" button POSTs to
 *      `/api/stripe/connect`, which creates the Express account
 *      (or re-binds `last_account_id`) and seeds the mirror row.
 *    - Account bound → mount `<ConnectAccountOnboarding>` until
 *      `chargesEnabled` is true, then swap to
 *      `<ConnectAccountManagement>`.
 *    - Always mount `<ConnectNotificationBanner>` so Stripe's
 *      verification + identity prompts surface inline.
 *
 *    The disconnect button now hits `/api/stripe/connect/disconnect`
 *    (server action) instead of writing to `user_metadata` directly
 *    — closes the §7.4 hole.
 *
 * @module app/(dashboard)/settings/payment-settings-section
 */
'use client';

import { loadConnectAndInitialize } from '@stripe/connect-js';
import type { StripeConnectInstance } from '@stripe/connect-js';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
} from '@stripe/react-connect-js';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConnectStatusPanel } from '@/components/settings/connect-status-panel';
import { useToast } from '@/components/ui/toast';
import type { ConnectAccountState } from '@/lib/payments/connect-account';
import { createClient } from '@/lib/supabase/client';

interface PaymentSettingsSectionProps {
  initialBankAccountName: string;
  initialBankBsb: string;
  initialBankAccountNumber: string;
  stripeConnectAccountId: string | null;
  stripeConnectEnabled: boolean;
  justConnected?: boolean;
}

export function PaymentSettingsSection({
  initialBankAccountName,
  initialBankBsb,
  initialBankAccountNumber,
  stripeConnectAccountId,
  stripeConnectEnabled,
}: PaymentSettingsSectionProps) {
  const supabase = createClient();
  const { toast } = useToast();

  /* ─── Bank-details state ────────────────────────────────────── */
  const [bankAccountName, setBankAccountName] = useState(initialBankAccountName);
  const [bankBsb, setBankBsb] = useState(initialBankBsb);
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccountNumber);
  const [bankSaving, setBankSaving] = useState(false);

  /* ─── Connect state ─────────────────────────────────────────── */
  // Local mirror of the bound account id — flips after the kickoff
  // call so the embedded components can mount on the next render
  // without a full reload.
  const [accountId, setAccountId] = useState<string | null>(
    stripeConnectAccountId,
  );
  const [connectState, setConnectState] = useState<ConnectAccountState | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Re-fetch status on mount + whenever the bound accountId changes
  // (kickoff or disconnect). Webhook-driven changes during the
  // session need a manual refresh today — fine for v1.
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await fetch('/api/stripe/connect/status');
    if (res.ok) {
      const { state } = (await res.json()) as { state: ConnectAccountState | null };
      setConnectState(state);
    }
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    if (accountId) {
      void refreshStatus();
    }
  }, [accountId, refreshStatus]);

  /* ─── Stripe Connect SDK instance ───────────────────────────── */
  // `loadConnectAndInitialize` is idempotent per `publishableKey`
  // but the SDK warns when called more than once on the same page.
  // useMemo keeps a single instance for the lifetime of this
  // component. The `fetchClientSecret` callback hits our route on
  // every embedded-component render — sessions are short-lived.
  const connectInstance: StripeConnectInstance | null = useMemo(() => {
    if (!accountId) return null;
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk) return null;
    return loadConnectAndInitialize({
      publishableKey: pk,
      fetchClientSecret: async () => {
        const res = await fetch('/api/stripe/connect/account-session', {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Could not create account session');
        const { client_secret } = (await res.json()) as {
          client_secret: string;
        };
        return client_secret;
      },
      // Light theming so the embedded components feel native. The
      // primary colour matches the brand-fg token; radii match
      // `rounded-control`.
      appearance: {
        variables: {
          colorPrimary: '#000000',
          colorBackground: '#ffffff',
          borderRadius: '6px',
        },
      },
    });
  }, [accountId]);

  /* ─── Bank details save (unchanged from previous design) ────── */
  const saveBankDetails = async () => {
    setBankSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBankSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        bank_account_name: bankAccountName,
        bank_bsb: bankBsb,
        bank_account_number: bankAccountNumber,
      },
    });
    setBankSaving(false);
    if (error) {
      toast(error.message, 'error');
    } else {
      toast('Bank details saved.');
    }
  };

  /* ─── Connect kickoff / disconnect ──────────────────────────── */
  const startOnboarding = async () => {
    setKicking(true);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      if (!res.ok) throw new Error('kickoff failed');
      const { accountId: newId } = (await res.json()) as { accountId: string };
      setAccountId(newId);
    } catch {
      toast('Could not start Stripe setup', 'error');
    } finally {
      setKicking(false);
    }
  };

  const disconnectStripe = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('disconnect failed');
      setAccountId(null);
      setConnectState(null);
      toast('Stripe disconnected.');
    } catch {
      toast('Could not disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  /* ─── Render ────────────────────────────────────────────────── */
  // The fully-charged "card payments work" state — `chargesEnabled`
  // is the cheap-read flag flipped by the `account.updated` webhook
  // once Stripe finishes verifying the account. `stripeConnectEnabled`
  // is the legacy mirror of the same flag in `app_metadata`; we
  // prefer the live mirror when it's loaded.
  const live = connectState?.chargesEnabled ?? stripeConnectEnabled;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Bank details */}
      <div>
        <h2 className="text-xl font-semibold text-text mb-1">Bank details</h2>
        <p className="text-sm text-text-muted mb-5">
          Auto-filled into invoice notes when you create a new invoice.
        </p>
        <div className="space-y-4">
          <BankField
            label="Account name"
            placeholder="e.g. John Smith Events"
            value={bankAccountName}
            onChange={setBankAccountName}
          />
          <BankField
            label="BSB"
            placeholder="e.g. 062-000"
            value={bankBsb}
            onChange={setBankBsb}
          />
          <BankField
            label="Account number"
            placeholder="e.g. 12345678"
            value={bankAccountNumber}
            onChange={setBankAccountNumber}
          />
          <button
            type="button"
            onClick={saveBankDetails}
            disabled={bankSaving}
            className="px-4 py-2 bg-brand-fg text-text-inverse text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
          >
            {bankSaving ? 'Saving…' : 'Save bank details'}
          </button>
        </div>
      </div>

      <hr className="border-border" />

      {/* Stripe Connect */}
      <div>
        <h2 className="text-xl font-semibold text-text mb-1">Card payments</h2>
        <p className="text-sm text-text-muted mb-5">
          Accept credit-card payments on invoices. Stripe handles
          verification + payouts; everything happens inside Zebri.
        </p>

        {!accountId ? (
          <button
            type="button"
            onClick={startOnboarding}
            disabled={kicking}
            className="inline-flex px-4 py-2 bg-brand-fg text-text-inverse text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
          >
            {kicking ? 'Setting up…' : 'Set up card payments'}
          </button>
        ) : (
          <div className="space-y-4">
            {/* Status panel — always rendered once a connection exists. */}
            {connectState ? (
              <ConnectStatusPanel
                state={connectState}
                onDisconnect={disconnectStripe}
                disconnecting={disconnecting}
              />
            ) : statusLoading ? (
              <div className="rounded-card border border-border bg-surface p-4 text-sm text-text-muted">
                Loading account status…
              </div>
            ) : null}

            {/* Embedded Stripe components. Wrapped in a single
                ConnectComponentsProvider so all three share the
                same instance. */}
            {connectInstance ? (
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <div className="rounded-card border border-border bg-surface p-4 space-y-3">
                  <ConnectNotificationBanner />
                  {live ? (
                    <ConnectAccountManagement />
                  ) : (
                    <ConnectAccountOnboarding
                      onExit={() => {
                        // Re-fetch our mirror — the embedded SDK
                        // doesn't proactively notify us when the
                        // user closes the flow; the webhook is
                        // the durable signal but a manual refresh
                        // here closes the gap if the webhook is
                        // delayed.
                        void refreshStatus();
                      }}
                    />
                  )}
                </div>
              </ConnectComponentsProvider>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function BankField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-text mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition"
      />
    </div>
  );
}
