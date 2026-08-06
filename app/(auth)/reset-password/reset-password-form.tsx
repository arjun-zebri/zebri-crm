/**
 * Reset-password request form (client component).
 *
 * Binds to {@link resetPasswordAction}. Shows a success notice after
 * a submission completes (the action always returns "success" to
 * avoid leaking which emails exist — the rate limit blocks
 * enumeration).
 *
 * @module app/(auth)/reset-password/reset-password-form
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { emptyAuthState } from '../action-state';
import { resetPasswordAction } from '../actions';

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, emptyAuthState);
  // Track whether the user has submitted at least once so we can
  // render the success notice (the action always returns "no error"
  // to avoid enumeration — we can't read "did it succeed?" from
  // state, but we know the action ran if pending toggles false after
  // a submit).
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!pending && submitted && !state.error) {
      // Form just settled with no error — success notice stays up.
    }
  }, [pending, submitted, state.error]);

  return (
    <Card className="shadow-sm sm:p-8">
      <div className="mb-6 flex justify-center">
        <Image src="/zebri-logo.svg" alt="Zebri" width={96} height={26} priority />
      </div>
      <h1 className="mb-2 text-center text-section font-semibold text-text">Reset password</h1>
      <p className="mb-6 text-center text-caption text-text-muted">
        Enter the email address associated with your account, and we&apos;ll send you a link to reset
        your password.
      </p>

      {state.error ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
        >
          {state.error}
        </div>
      ) : submitted && !pending ? (
        <div
          role="status"
          className="mb-4 rounded-control border border-success/40 bg-success/10 p-3 text-caption text-success"
        >
          If an account exists for that email, a reset link is on its way.
        </div>
      ) : null}

      <form action={formAction} onSubmit={() => setSubmitted(true)} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          {...(state.fieldErrors?.email ? { error: state.fieldErrors.email } : {})}
        />

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-caption text-text-muted">
        <Link href="/login" className="text-text underline hover:text-text-muted">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
