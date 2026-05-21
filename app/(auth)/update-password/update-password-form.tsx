/**
 * Set-new-password form (client component).
 *
 * Binds to {@link updatePasswordAction}. Shares the password meter
 * + strength schema with signup and Settings change-password.
 *
 * @module app/(auth)/update-password/update-password-form
 */
'use client';

import { useActionState, useState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { emptyAuthState, updatePasswordAction } from '../actions';

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, emptyAuthState);
  const [password, setPassword] = useState('');

  return (
    <div className="rounded-control border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="mb-2 text-center text-xl font-semibold text-text">Set new password</h1>
      <p className="mb-6 text-center text-caption text-text-muted">
        Choose a new password for your account.
      </p>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
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
            placeholder="At least 10 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="Min. 10 chars. Include upper + lower + number + symbol."
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
          placeholder="Re-enter your new password"
          {...(state.fieldErrors?.confirmPassword ? { error: state.fieldErrors.confirmPassword } : {})}
        />

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
