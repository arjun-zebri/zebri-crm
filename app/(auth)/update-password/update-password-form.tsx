/**
 * Set-new-password form (client component).
 *
 * Binds to {@link updatePasswordAction}. Shares the password meter
 * + strength schema with signup and Settings change-password.
 *
 * @module app/(auth)/update-password/update-password-form
 */
'use client';

import Image from 'next/image';
import { useActionState, useState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { emptyAuthState } from '../action-state';
import { updatePasswordAction } from '../actions';

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, emptyAuthState);
  const [password, setPassword] = useState('');

  return (
    <Card className="shadow-sm sm:p-8">
      <div className="mb-6 flex justify-center">
        <Image src="/zebri-logo.svg" alt="Zebri" width={96} height={26} priority />
      </div>
      <h1 className="mb-2 text-center text-section font-semibold text-text">Set new password</h1>
      <p className="mb-6 text-center text-body text-text-muted">
        Choose a new password for your account.
      </p>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-body text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="At least 10 characters with upper, lower, number, and symbol."
            {...(state.fieldErrors?.password ? { error: state.fieldErrors.password } : {})}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          {...(state.fieldErrors?.confirmPassword ? { error: state.fieldErrors.confirmPassword } : {})}
        />

        <Button type="submit" loading={pending} className="w-full">Update password</Button>
      </form>
    </Card>
  );
}
