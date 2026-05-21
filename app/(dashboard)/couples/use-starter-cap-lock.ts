/**
 * Starter cap lock — UX-layer guard that fires when a Starter user
 * has more couples than the free tier allows.
 *
 * Background: the 5-couple cap is enforced at the data layer by the
 * `enforce_starter_couple_limit` Postgres trigger, which blocks the
 * INSERT of new couples. But existing couples remain readable, so a
 * user who downgrades Pro → Starter (or whose subscription expires)
 * after creating 10 couples can still see all of them.
 *
 * This hook returns a `locked` boolean that the couples page uses to
 * intercept couple-modal opens. When locked, clicking a couple shows
 * the {@link StarterCapLockModal} instead of opening the profile.
 *
 * Reads entitlement state via the canonical helper (`currentPlan` from
 * `@/lib/auth/entitlements`) — never touches `user_metadata` directly,
 * so the §7.4 escalation surface stays closed.
 *
 * @module app/(dashboard)/couples/use-starter-cap-lock
 */
'use client';

import { useEffect, useState } from 'react';

import { currentPlan } from '@/lib/auth/entitlements';
import { createClient } from '@/lib/supabase/client';

export interface StarterCapLockState {
  /** True when the cap is exceeded AND the user is on Starter. */
  locked: boolean;
  /** Cap for the Starter tier. Currently 5. */
  cap: number;
  /** Whether the user is actually on Starter (regardless of count). */
  onStarter: boolean;
}

export const STARTER_COUPLE_CAP = 5;

export function useStarterCapLock(coupleCount: number): StarterCapLockState {
  const [onStarter, setOnStarter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      setOnStarter(currentPlan(user ?? null) === 'starter');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    locked: onStarter && coupleCount > STARTER_COUPLE_CAP,
    cap: STARTER_COUPLE_CAP,
    onStarter,
  };
}
