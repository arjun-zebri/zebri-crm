'use client';

import { Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';
import { TextLink } from '@/components/ui-v2/text-link';

import { AuthShell } from './auth-shell';
import { SocialButtons } from './social-buttons';
import { isEmail, useDemoSubmit } from './use-demo-submit';

/**
 * v2 sign up page: just email and password, laid out like the log in
 * page. Name and business name are no longer asked for up front (the
 * live `/signup` still collects them). A demo: submitting validates and
 * shows the loading state, then goes to onboarding.
 *
 * @module app/design-system/v2/pages/signup-form
 */
export function SignupPageV2({ contained = false }: { contained?: boolean }) {
  const router = useRouter();
  const { errors, loading, onSubmit } = useDemoSubmit(
    (v) => ({
      email: isEmail(v.email) ? undefined : 'Enter a valid email address.',
      password: (v.password ?? '').length >= 8 ? undefined : 'Use at least 8 characters.',
    }),
    // The showroom's framed preview stays put.
    () => (contained ? undefined : router.push('/design-system/v2/onboarding')),
  );
  const icon = 'size-4';
  return (
    <AuthShell
      contained={contained}
      title="Create your account"
      footer={
        <>
          Already have an account? <TextLink href="/design-system/v2/login">Log in</TextLink>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          leading={<Mail strokeWidth={1.5} className={icon} />}
          error={errors.email}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leading={<Lock strokeWidth={1.5} className={icon} />}
          error={errors.password}
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <SocialButtons verb="Sign up" />
    </AuthShell>
  );
}
