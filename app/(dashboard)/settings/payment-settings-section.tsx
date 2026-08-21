/**
 * Settings → Receive Payments tab.
 *
 * Document-style composition matching the Plans & Billing tab: small
 * UPPERCASE section labels + thin dividers, no nested bordered cards
 * for top-level layout. Two sections:
 *
 * 1. **Bank details**: auto-filled into invoice notes. Stored in
 *    `user_metadata`. The Save button lives at the section footer
 *    (right-aligned), not in the middle of the form.
 *
 * 2. **Card payments via Stripe Connect**: Phase 2D.1. Mounts the
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
 *    Disconnect routes through `/api/stripe/connect/disconnect`:
 *    the §7.4 client-side `user_metadata` write is closed.
 *
 * @module app/(dashboard)/settings/payment-settings-section
 */
'use client';

// `/pure` skips the side-effectful auto-load of ConnectJS at module
// eval time, which Next.js triggers during SSR / static page gen
// and which Stripe explicitly warns against. The runtime behaviour
// is identical, the script loads on first call to
// `loadConnectAndInitialize`. See
// https://github.com/stripe/connect-js#importing-loadconnect-without-side-effects
import type { StripeConnectInstance } from '@stripe/connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
} from '@stripe/react-connect-js';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ConnectStatusPanel } from '@/components/settings/connect-status-panel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { ConnectAccountState } from '@/lib/payments/connect-account';
import { createClient } from '@/lib/supabase/client';

import { AutoSaveStatus, type SaveState } from './auto-save-status';

interface PaymentSettingsSectionProps {
  initialBankAccountName: string;
  initialBankBsb: string;
  initialBankAccountNumber: string;
  stripeConnectAccountId: string | null;
  stripeConnectEnabled: boolean;
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
  const [bankSaveState, setBankSaveState] = useState<SaveState>('idle');
  // Last-persisted baseline so a blur with no real change is a no-op.
  const savedBankRef = useRef({
    name: initialBankAccountName,
    bsb: initialBankBsb,
    number: initialBankAccountNumber,
  });
  const bankSavingRef = useRef(false);

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

  /**
   * Sync the mirror directly from Stripe (bypassing the webhook).
   * The webhook is the source of truth in production, but it has
   * lag, and in local dev without `stripe listen`, it never fires
   * at all. Calling this on embedded-component exit closes both
   * gaps. Followed by a status refresh to pick up the new mirror.
   */
  const syncFromStripe = useCallback(async () => {
    const res = await fetch('/api/stripe/connect/sync', { method: 'POST' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
      };
      console.error('[settings/payments] sync failed', body);
      return;
    }
    await refreshStatus();
  }, [refreshStatus]);

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

  /* ─── Bank details auto-save (on blur) ──────────────────────── */
  const saveBankDetails = async () => {
    const s = savedBankRef.current;
    const dirty =
      bankAccountName !== s.name ||
      bankBsb !== s.bsb ||
      bankAccountNumber !== s.number;
    if (bankSavingRef.current || !dirty) return;
    bankSavingRef.current = true;
    setBankSaveState('saving');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBankSaveState('error');
      bankSavingRef.current = false;
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
    if (error) {
      toast(error.message, 'error');
      setBankSaveState('error');
    } else {
      savedBankRef.current = { name: bankAccountName, bsb: bankBsb, number: bankAccountNumber };
      setBankSaveState('saved');
    }
    bankSavingRef.current = false;
  };

  /* ─── Connect kickoff / disconnect ──────────────────────────── */
  const startOnboarding = async () => {
    setKicking(true);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      if (!res.ok) throw new Error('kickoff failed');
      const { accountId: newId } = (await res.json()) as { accountId: string };
      // Same JWT-staleness issue as disconnect: the server-side
      // updateEntitlements wrote the new accountId to app_metadata
      // but the client JWT still doesn't carry it. Refresh the
      // session before we render the embedded onboarding so the
      // settings page sees the binding consistently.
      await supabase.auth.refreshSession();
      setAccountId(newId);
      toast('Stripe account created, complete the verification below.');
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        // Surface the real reason: generic "Could not disconnect"
        // hides the underlying Supabase / Stripe error and makes
        // dev debugging impossible.
        const reason = body.detail ?? body.error ?? `HTTP ${res.status}`;
        console.error('[settings/payments] disconnect failed', body);
        throw new Error(reason);
      }
      // The server cleared app_metadata but the user's JWT still
      // carries the stale `stripe_connect_account_id`, Supabase
      // doesn't auto-refresh JWTs when admin updates app_metadata.
      // Refresh the session so the next render sees the cleared
      // entitlement, then reload so the parent settings page
      // re-fetches user data and our props are fresh.
      await supabase.auth.refreshSession();
      toast('Stripe disconnected.');
      window.location.assign('/settings?tab=payments');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      toast(`Could not disconnect: ${reason}`, 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  // `charges_enabled` flag from the live mirror. Falls back to the
  // server-managed entitlement bool when the mirror hasn't loaded yet.
  const chargesLive = connectState?.chargesEnabled ?? stripeConnectEnabled;

  return (
    <div className="space-y-12">
      {/* ─── Bank details ─────────────────────────────────────── */}
      <Section label="Bank details">
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-body text-text-muted">
            Auto-filled into invoice notes when you create a new invoice. Changes save automatically.
          </p>
          <AutoSaveStatus state={bankSaveState} />
        </div>
        <div className="space-y-4">
          <BankField
            label="Account name"
            placeholder="e.g. John Smith Events"
            value={bankAccountName}
            onChange={setBankAccountName}
            onBlur={saveBankDetails}
          />
          <BankField
            label="BSB"
            placeholder="e.g. 062-000"
            value={bankBsb}
            onChange={setBankBsb}
            onBlur={saveBankDetails}
          />
          <BankField
            label="Account number"
            placeholder="e.g. 12345678"
            value={bankAccountNumber}
            onChange={setBankAccountNumber}
            onBlur={saveBankDetails}
          />
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
                onSync={syncFromStripe}
              />
            ) : statusLoading ? (
              <div className="rounded-control border border-border bg-surface p-4 text-body text-text-muted">
                Loading account status…
              </div>
            ) : null}

            {connectInstance ? (
              <ConnectComponentsProvider connectInstance={connectInstance}>
                <div className="rounded-control border border-border bg-surface p-4 space-y-3">
                  <ConnectNotificationBanner />
                  {chargesLive ? (
                    <ConnectAccountManagement />
                  ) : (
                    <ConnectAccountOnboarding
                      onExit={() => {
                        // The webhook is the durable signal, but it
                        // has lag (and never fires at all in local
                        // dev without `stripe listen`). Pull
                        // directly from Stripe → mirror so the
                        // status panel can flip immediately.
                        void syncFromStripe();
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
                error and the status panel never loads, leaving
                the MC stuck. This footer link is the escape hatch:
                clears `app_metadata.stripe_connect_*` server-side
                so the section flips back to the empty-state CTA
                and a fresh account can be created. */}
            {!connectState && !statusLoading ? (
              <div className="flex items-center justify-between rounded-control border border-border bg-surface-muted/40 p-3">
                <p className="text-body text-text-muted">
                  Stuck? If the form above shows an error, the connected
                  Stripe account may be stale. Reset to start fresh.
                </p>
                <Button
                  variant="ghost"
                  onClick={disconnectStripe}
                  loading={disconnecting}
                  className="hover:text-danger"
                >
                  Reset connection
                </Button>
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
 * Document-style section header: matches the Billing tab pattern
 * (small UPPERCASE label on the left + a thin divider line filling
 * the rest of the row).
 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h3 className="text-body font-medium uppercase tracking-wide text-text-muted">
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
  onBlur,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label className="block text-body text-text mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full border border-border rounded-control px-3 py-2 text-body text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition"
      />
    </div>
  );
}

/**
 * The "no Stripe account yet" hero card. Mirrors the layout language
 * of CurrentPlanCard on the Billing tab: a single rounded surface
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
    <div className="rounded-control border border-border bg-surface p-5">
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
          <p className="mt-1 text-body text-text-muted">
            Connect a Stripe account so couples can pay invoices by card.
            Verification happens inside Zebri, Stripe handles ID checks,
            documents, and payouts.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onSetUp} loading={loading}>Set up card payments</Button>
      </div>
    </div>
  );
}

/**
 * Dev-config error UI: shown when an MC has a connected Stripe
 * account but the embedded SDK can't initialise because
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY isn't set. Without this
 * fallback the section would silently render empty.
 */
function PublishableKeyMissingCard() {
  return (
    <div className="flex items-start gap-3 rounded-control border border-warning/40 bg-warning/5 p-4">
      <AlertTriangle
        size={18}
        strokeWidth={1.5}
        className="shrink-0 text-warning mt-0.5"
      />
      <div className="text-body text-text">
        <p className="font-medium">Stripe publishable key missing</p>
        <p className="mt-1 text-body text-text-muted">
          The embedded Connect onboarding component needs
          <code className="font-mono px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>
          in your <code className="font-mono">.env.local</code>. Set it and
          reload, the onboarding form will mount here).
        </p>
      </div>
    </div>
  );
}
