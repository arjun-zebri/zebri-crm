/**
 * Login form (client component).
 *
 * Binds to {@link loginAction} via `useActionState`. The form
 * surfaces inline field errors when validation fails and a global
 * banner for top-level errors (rate-limit, wrong credentials).
 *
 * @module app/(auth)/login/login-form
 */
'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { emptyAuthState, loginAction } from '../actions';

export interface LoginFormProps {
  /** Optional `?next` value forwarded as a hidden field. */
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, emptyAuthState);
  return (
    <div className="rounded-control border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="mb-6 text-center text-xl font-semibold text-text">Sign in</h1>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          {...(state.fieldErrors?.email ? { error: state.fieldErrors.email } : {})}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          {...(state.fieldErrors?.password ? { error: state.fieldErrors.password } : {})}
        />

        <div className="pt-1">
          <Link
            href="/reset-password"
            className="text-caption text-text-muted underline hover:text-text"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-caption text-text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-text underline hover:text-text-muted">
          Sign up
        </Link>
      </p>
    </div>
  );
}
