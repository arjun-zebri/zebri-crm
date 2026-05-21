/**
 * Signup form (client component).
 *
 * Binds to {@link signupAction} via `useActionState`. The password
 * field is paired with the shared {@link PasswordStrengthMeter}
 * primitive so signup, update-password, and change-password share
 * the same real-time feedback.
 *
 * @module app/(auth)/signup/signup-form
 */
'use client';

import Link from 'next/link';
import { useState, useActionState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { emptyAuthState, signupAction } from '../actions';

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, emptyAuthState);
  const [password, setPassword] = useState('');

  return (
    <div className="rounded-control border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="mb-6 text-center text-xl font-semibold text-text">Create account</h1>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <Input
          label="Full name"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          placeholder="Jane Doe"
          {...(state.fieldErrors?.displayName ? { error: state.fieldErrors.displayName } : {})}
        />

        <Input
          label="Business name"
          name="businessName"
          type="text"
          autoComplete="organization"
          required
          placeholder="Your MC business"
          {...(state.fieldErrors?.businessName ? { error: state.fieldErrors.businessName } : {})}
        />

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          {...(state.fieldErrors?.email ? { error: state.fieldErrors.email } : {})}
        />

        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 10 characters, mixed case + number + symbol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="Min. 10 chars. Include upper + lower + number + symbol."
            {...(state.fieldErrors?.password ? { error: state.fieldErrors.password } : {})}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-caption text-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-text underline hover:text-text-muted">
          Sign in
        </Link>
      </p>
    </div>
  );
}
