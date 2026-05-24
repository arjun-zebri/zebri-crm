/**
 * Settings → Receive Payments tab.
 *
 * Document-style composition matching the Plans & Billing tab — small
 * UPPERCASE section labels + thin dividers, no nested bordered cards
 * for top-level layout. Two sections:
 *
 * 1. **Bank details** — auto-filled into invoice notes. Stored in
 *    `user_metadata`. The Save button lives at the section footer
 *    (right-aligned), not in the middle of the form.
 *
 * 2. **Card payments via Stripe Connect** — Phase 2D.1. Mounts the
 *    Stripe embedded Connect components (`<ConnectAccountOnboarding>`
 *    / `<ConnectAccountManagement>` + `<ConnectNotificationBanner>`)
 *    inline. The MC never leaves Zebri.
 *
 *    Three UI states once an account is bound:
 *    - **Status panel loaded** → shows capabilities + requirements
 *      from `connect_accounts`.
 *    - **Embedded SDK ready** → shows the appropriate onboarding /
 *      management component below the panel.
 *    - **Publishable key missing** → shows a clear error explaining
 *      the env-var gap so dev setups don't render an empty section.
 *
 *    Disconnect routes through `/api/stripe/connect/disconnect` —
 *    the §7.4 client-side `user_metadata` write is closed.
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
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ConnectStatusPanel } from '@/components/settings/connect-status-panel';
import { Button } from '@/components/ui/button';
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
  const [accountId, setAccountId] = useState<string | null>(
    stripeConnectAccountId,
  );
  const [connectState, setConnectState] = useState<ConnectAccountState | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  /* ─── Stripe Connect SDK instance ───────────────────────────── */
  const connectInstance: StripeConnectInstance | null = useMemo(() => {
    if (!accountId || !publishableKey) return null;
    return loadConnectAndInitialize({
      publishableKey,
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
      appearance: {
        variables: {
          colorPrimary: '#000000',
          colorBackground: '#ffffff',
          borderRadius: '6px',
        },
      },
    });
  }, [accountId, publishableKey]);

  /* ─── Bank details save ─────────────────────────────────────── */
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
      toast('Stripe account created — complete the verification below.');
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

  // `charges_enabled` flag from the live mirror. Falls back to the
  // server-managed entitlement bool when the mirror hasn't loaded yet.
  const chargesLive = connectState?.chargesEnabled ?? stripeConnectEnabled;

  return (
    <div className="max-w-3xl space-y-12">
      {/* ─── Bank details ─────────────────────────────────────── */}
      <Section label="Bank details">
        <p className="mb-5 text-body text-text-muted">
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
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveBankDetails} loading={bankSaving}>
            Save bank details
          </Button>
        </div>
      </Section>

      {/* ─── Card payments ───────────────────────────────────── */}
      <Section label="Card payments">
        <p className="mb-5 text-body text-text-muted">
          Accept credit-card payments on invoices. Stripe handles
          verification + payouts; everything happens inside Zebri.
        </p>

        {!accountId ? (
          <EmptyCardPaymentsCard
            onSetUp={startOnboarding}
            loading={kicking}
          />
        ) : !publishableKey ? (
          <PublishableKeyMissingCard />
        ) : (
          <div className="space-y-4">
            {connectState ? (
              <ConnectStatusPanel
                state={connectState}
                onDisconnect={disconnectStripe}
                disconnecting={disconnecting}
              />
            ) : statusLoading ? (
              <div className="rounded-card border border-border bg-surface p-4 text-body text-text-muted">
                Loading account status…
              </div>
            ) : null}

            {connectInstance ? (
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <div className="rounded-card border border-border bg-surface p-4 space-y-3">
                  <ConnectNotificationBanner />
                  {chargesLive ? (
                    <ConnectAccountManagement />
                  ) : (
                    <ConnectAccountOnboarding
                      onExit={() => {
                        // Re-fetch our mirror — the embedded SDK
                        // doesn't proactively notify us when the
                        // user closes the flow; the webhook is the
                        // durable signal but a manual refresh here
                        // closes the gap if the webhook is delayed.
                        void refreshStatus();
                      }}
                    />
                  )}
                </div>
              </ConnectComponentsProvider>
            ) : null}

            {/* Always-visible reset affordance. The status panel's
                disconnect button is the primary path, but it only
                renders when the mirror row exists. If the bound
                Stripe account is stale (created against a different
                API key, deleted on Stripe's side, etc.) the
                embedded SDK shows its own "Something went wrong"
                error and the status panel never loads — leaving
                the MC stuck. This footer link is the escape hatch:
                clears `app_metadata.stripe_connect_*` server-side
                so the section flips back to the empty-state CTA
                and a fresh account can be created. */}
            {!connectState && !statusLoading ? (
              <div className="flex items-center justify-between rounded-card border border-border bg-surface-muted/40 p-3">
                <p className="text-caption text-text-muted">
                  Stuck? If the form above shows an error, the connected
                  Stripe account may be stale. Reset to start fresh.
                </p>
                <button
                  type="button"
                  onClick={disconnectStripe}
                  disabled={disconnecting}
                  className="text-caption font-medium text-text-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
                >
                  {disconnecting ? 'Resetting…' : 'Reset connection'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

/**
 * Document-style section header — matches the Billing tab pattern
 * (small UPPERCASE label on the left + a thin divider line filling
 * the rest of the row).
 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          {label}
        </h3>
        <div className="flex-1 border-t border-border" />
      </div>
      {children}
    </section>
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
      <label className="block text-body text-text mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-xl px-3 py-2 text-body text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition"
      />
    </div>
  );
}

/**
 * The "no Stripe account yet" hero card. Mirrors the layout language
 * of CurrentPlanCard on the Billing tab — a single rounded surface
 * with an icon, a one-line value prop, and a primary CTA.
 */
function EmptyCardPaymentsCard({
  onSetUp,
  loading,
}: {
  onSetUp: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-muted">
          <CreditCard
            size={18}
            strokeWidth={1.5}
            className="text-text-muted"
          />
        </div>
        <div className="flex-1">
          <p className="text-body font-medium text-text">
            Set up card payments
          </p>
          <p className="mt-1 text-caption text-text-muted">
            Connect a Stripe account so couples can pay invoices by card.
            Verification happens inside Zebri — Stripe handles ID checks,
            documents, and payouts.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onSetUp} loading={loading}>
          {loading ? 'Setting up…' : 'Set up card payments'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Dev-config error UI — shown when an MC has a connected Stripe
 * account but the embedded SDK can't initialise because
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY isn't set. Without this
 * fallback the section would silently render empty.
 */
function PublishableKeyMissingCard() {
  return (
    <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/5 p-4">
      <AlertTriangle
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-warning mt-0.5"
      />
      <div className="text-body text-text">
        <p className="font-medium">Stripe publishable key missing</p>
        <p className="mt-1 text-caption text-text-muted">
          The embedded Connect onboarding component needs
          <code className="font-mono px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
          in your <code className="font-mono">.env.local</code>. Set it and
          reload — the onboarding form will mount here.
        </p>
      </div>
    </div>
  );
}
