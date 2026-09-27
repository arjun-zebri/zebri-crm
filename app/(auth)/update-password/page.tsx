/**
 * Update-password (post-magic-link) page.
 *
 * Server component. Unlike the other auth pages, this one requires
 * an active session (set by the Supabase magic link). Visitors
 * without a session land here by mistake — redirect them back to
 * the reset-password request page.
 *
 * @module app/(auth)/update-password/page
 */
import { redirect } from 'next/navigation';

import { needsSecondFactor, SECOND_FACTOR_PATH } from '@/lib/auth/mfa';
import { createClient } from '@/lib/supabase/server';

import { UpdatePasswordForm } from './update-password-form';

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/reset-password');
  // The reset link signs in at aal1. With two-factor sign-in on, Supabase
  // refuses a password change below aal2, so take the code first and come
  // back here (Phase 4, Task 23). /update-password is a public route, so
  // the middleware gate does not do this for us.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (needsSecondFactor(user, session?.access_token)) {
    redirect(`${SECOND_FACTOR_PATH}?next=${encodeURIComponent('/update-password')}`);
  }
  return <UpdatePasswordForm />;
}
