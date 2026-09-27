/**
 * The second-factor card: the 6-digit code by default, a recovery code
 * on request, and a way out (sign out) for someone who landed here with
 * neither. Same card and logo as the sign-in form so the step reads as
 * the second half of signing in, not a new place.
 *
 * @module app/(auth)/login/mfa/second-factor-screen
 */
'use client';

import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

import { RecoveryCodeForm } from './recovery-code-form';
import { TotpCodeForm } from './totp-code-form';

export interface SecondFactorScreenProps {
  /** Validated same-origin path to continue to once the code checks out. */
  next?: string;
}

/** Second-factor sign-in card. See {@link SecondFactorScreenProps}. */
export function SecondFactorScreen({ next }: SecondFactorScreenProps) {
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    // Always local (review I1): whoever is here has not proven the second
    // factor, so they must never end the account's other sessions. This
    // is also the only way out for support whose shadow grant expired.
    await createClient().auth.signOut({ scope: 'local' });
    window.location.assign('/login');
  }

  return (
    <Card className="shadow-sm sm:p-8">
      <div className="mb-6 flex justify-center">
        <Image src="/zebri-logo.svg" alt="Zebri" width={96} height={26} priority />
      </div>
      <h1 className="mb-2 text-center text-section font-semibold text-text">Two-factor sign-in</h1>
      <p className="mb-6 text-center text-body text-text-muted">
        {mode === 'code'
          ? 'Enter the 6-digit code from your authenticator app.'
          : 'Enter one of the recovery codes you saved when you turned on two-factor sign-in.'}
      </p>

      {mode === 'code' ? <TotpCodeForm next={next ?? '/'} /> : <RecoveryCodeForm />}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode(mode === 'code' ? 'recovery' : 'code')}
        >
          {mode === 'code' ? 'Use a recovery code' : 'Use my authenticator app'}
        </Button>
        <Button type="button" variant="ghost" loading={signingOut} onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Card>
  );
}
