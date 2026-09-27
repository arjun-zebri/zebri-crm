/**
 * Loads whether the signed-in MC has two-factor sign-in on, and how many
 * recovery codes they have left, for the Settings card.
 *
 * The factor list comes from `mfa.listFactors()`, which asks the Auth
 * server. The count comes from a server action because the recovery-code
 * table is service-role only.
 *
 * @module app/(dashboard)/settings/use-two-factor
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { recoveryCodesLeftAction } from './account/two-factor-actions';

/** The verified authenticator-app factor, when there is one. */
export interface TotpFactorSummary {
  id: string;
  createdAt: string;
}

/** What the card renders from. */
export type TwoFactorState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      factor: TotpFactorSummary | null;
      /** Unused recovery codes; null when the count could not be read. */
      remaining: number | null;
    };

async function readTwoFactor(): Promise<TwoFactorState> {
  try {
    const { data, error } = await createClient().auth.mfa.listFactors();
    if (error) return { status: 'error' };
    // `totp` lists verified TOTP factors only; a half-finished enrolment
    // sits in `all` as unverified and does not count as "on".
    const verified = data.totp[0];
    if (!verified) return { status: 'ready', factor: null, remaining: null };
    const left = await recoveryCodesLeftAction();
    return {
      status: 'ready',
      factor: { id: verified.id, createdAt: verified.created_at },
      remaining: left.ok ? left.remaining : null,
    };
  } catch {
    // Network failure or a failed server action: unknown, not "off".
    return { status: 'error' };
  }
}

/** Two-factor status for the Settings card, plus a reload after changes. */
export function useTwoFactor(): { state: TwoFactorState; reload: () => void } {
  const [state, setState] = useState<TwoFactorState>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    void readTwoFactor().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    void readTwoFactor().then(setState);
  }, []);

  return { state, reload };
}
