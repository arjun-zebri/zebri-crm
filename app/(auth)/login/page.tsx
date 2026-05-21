/**
 * Login page.
 *
 * Server component: redirects already-logged-in users away from the
 * form. The `?next=<path>` search param is forwarded into the
 * client form's hidden field so the post-login redirect can bounce
 * the user back to where they were headed (validated against
 * {@link sameOriginPathSchema} server-side).
 *
 * @module app/(auth)/login/page
 */
import { redirect } from 'next/navigation';

import { sameOriginPathSchema } from '@/lib/auth/schemas';
import { createClient } from '@/lib/supabase/server';

import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/');

  // Sanitise `next` server-side too — defence in depth against a
  // malicious link slipping a non-relative path through.
  const { next: rawNext } = await searchParams;
  const next = rawNext && sameOriginPathSchema.safeParse(rawNext).success ? rawNext : undefined;

  return next ? <LoginForm next={next} /> : <LoginForm />;
}
