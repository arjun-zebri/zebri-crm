/**
 * State and steps of turning on two-factor sign-in, for
 * {@link TwoFactorEnrolModal}.
 *
 * Enrolment runs in the browser through Supabase's MFA API. The factor
 * stays unverified until a code from the app checks out, which also
 * raises this session to aal2; only then are recovery codes issued
 * (server side, since that needs aal2).
 *
 * 2FA must never end up on without recovery codes, or a lost phone locks
 * the MC out for good. So {@link TotpEnrolment.cancel} removes the factor
 * whenever codes were not issued: an unverified factor, and also a
 * verified one whose code issuing failed.
 *
 * @module app/(dashboard)/settings/use-totp-enrolment
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import { beginTotpAttemptAction } from '@/app/(auth)/login/mfa/totp-attempt';
import { createClient } from '@/lib/supabase/client';

import { issueRecoveryCodesAction } from './account/two-factor-actions';
import { type PendingFactor, startEnrolment } from './totp-enrolment-start';

export type { PendingFactor } from './totp-enrolment-start';

/** What {@link useTotpEnrolment} exposes. */
export interface TotpEnrolment {
  pending: PendingFactor | null;
  /** Setup could not start at all. */
  failed: boolean;
  /** The code checked out; the factor is live. */
  verified: boolean;
  /** Recovery codes, once issued. */
  codes: string[] | null;
  error: string | null;
  busy: boolean;
  verify: (code: string) => Promise<void>;
  issueCodes: () => Promise<void>;
  /**
   * Undo a half-finished enrolment (see module doc). Resolves false when a
   * live factor with no codes could not be removed: the caller must then
   * stay open, since closing would leave 2FA on with no way to recover.
   */
  cancel: () => Promise<boolean>;
}

/** Drive one enrolment, started on mount. */
export function useTotpEnrolment(): TotpEnrolment {
  const [pending, setPending] = useState<PendingFactor | null>(null);
  const [failed, setFailed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One enrolment per open. React runs this effect twice on a dev mount
  // (StrictMode) and would otherwise start two enrolments that race each
  // other; the ref survives that remount, so both runs share one.
  const enrolment = useRef<Promise<PendingFactor> | null>(null);

  useEffect(() => {
    let live = true;
    enrolment.current ??= startEnrolment();
    enrolment.current.then(
      (p) => live && setPending(p),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  async function issueCodes() {
    setBusy(true);
    const result = await issueRecoveryCodesAction();
    setBusy(false);
    if (result.ok) setCodes(result.codes);
    else setError(`${result.error} Try again, or close this to turn two-factor sign-in off again.`);
  }

  async function verify(code: string) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const attempt = await beginTotpAttemptAction();
    if (!attempt.ok) {
      setBusy(false);
      setError(attempt.error);
      return;
    }
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId: pending.factorId,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setError('That code did not work. Try the newest code in the app.');
      return;
    }
    setVerified(true);
    await issueCodes();
  }

  async function cancel(): Promise<boolean> {
    if (!pending || codes) return true;
    // Unverified: removable at aal1. Verified without codes: this session
    // reached aal2 when the code checked out, which Supabase requires to
    // remove a verified factor.
    let failedToRemove: boolean;
    try {
      const { error: unenrollError } = await createClient().auth.mfa.unenroll({
        factorId: pending.factorId,
      });
      failedToRemove = Boolean(unenrollError);
    } catch {
      failedToRemove = true;
    }
    // A leftover UNVERIFIED factor is harmless (2FA is not on, and the next
    // enrolment clears it), so only a live factor blocks closing.
    if (failedToRemove && verified) {
      setError(
        'Two-factor sign-in is on but has no recovery codes, and we could not turn it off. Try again, or create recovery codes from Settings.',
      );
      return false;
    }
    return true;
  }

  return { pending, failed, verified, codes, error, busy, verify, issueCodes, cancel };
}
