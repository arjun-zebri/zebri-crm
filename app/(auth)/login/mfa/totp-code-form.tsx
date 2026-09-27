/**
 * The 6-digit authenticator code form on the second-factor screen.
 *
 * Verifies in the browser with `mfa.challengeAndVerify`, which is how
 * Supabase raises the session to aal2: the upgraded session lands in the
 * auth cookies, so the next request passes the middleware gate. The
 * factor comes from `listFactors()`, which asks the Auth server, not from
 * the cookie copy of the user.
 *
 * @module app/(auth)/login/mfa/totp-code-form
 */
'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

import { beginTotpAttemptAction } from './totp-attempt';

export interface TotpCodeFormProps {
  /** Where to go once the code checks out. Already validated as same-origin. */
  next: string;
}

/** Six-digit code entry + verify. See {@link TotpCodeFormProps}. */
export function TotpCodeForm({ next }: TotpCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter all 6 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    const attempt = await beginTotpAttemptAction();
    if (!attempt.ok) {
      setBusy(false);
      setError(attempt.error);
      return;
    }
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    // `totp` holds verified TOTP factors only.
    const factor = factors?.totp[0];
    if (listError || !factor) {
      setBusy(false);
      setError('We could not load your two-factor settings. Refresh the page and try again.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setCode('');
      setError('That code did not work. Codes change every 30 seconds, so try the newest one.');
      return;
    }
    // A full navigation, not router.push: the middleware must see the
    // upgraded session cookie on a fresh request.
    window.location.assign(next);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
      <Input
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        {...(error ? { error } : {})}
      />
      <Button type="submit" loading={busy} className="w-full">
        Verify
      </Button>
    </form>
  );
}
