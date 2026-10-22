'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { EmailIcon, LockIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';
import { TextLink } from '@/components/ui-v2/text-link';

import { AuthShell } from './auth-shell';
import { FIRST_RUN_PATH } from './dashboard/first-run/handoff';
import { SocialButtons } from './social-buttons';
import { isEmail, useDemoSubmit } from './use-demo-submit';

/**
 * v2 log in page, rebuilt from v2 primitives: the social options, then
 * email and password (boxed, with their names above and their Zebri icons inside: the
 * entry screens are the one place fields keep a box), remember-me
 * beside forgot-password, and the primary button last. A demo: submitting validates and
 * shows the loading state, then goes to the first-run dashboard.
 *
 * @module app/design-system/v2/pages/login-form
 */
export function LoginPageV2({ contained = false }: { contained?: boolean }) {
  const router = useRouter();
  const { errors, loading, onSubmit } = useDemoSubmit(
    (v) => ({
      email: isEmail(v.email) ? undefined : 'Enter a valid email address.',
      password: v.password ? undefined : 'Enter your password.',
    }),
    // The showroom's framed preview stays put.
    () => (contained ? undefined : router.push(FIRST_RUN_PATH)),
  );
  return (
    <AuthShell
      contained={contained}
      title="Welcome back"
      footer={
        <>
          Don&rsquo;t have an account? <TextLink href="/design-system/v2/signup">Sign up</TextLink>
        </>
      }
    >
      <SocialButtons />
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-5">
          <Input
            boxed
            icon={EmailIcon}
            label="Email"
            placeholder="you@example.com"
            name="email"
            type="email"
            autoComplete="email"
            error={errors.email}
          />
          <PasswordInput
            boxed
            icon={LockIcon}
            label="Password"
            name="password"
            autoComplete="current-password"
            error={errors.password}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Checkbox label="Remember me" name="remember" />
          <TextLink href="#">Forgot password?</TextLink>
        </div>
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
