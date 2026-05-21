/**
 * Reset-password (request email) page.
 *
 * Server component: redirects already-logged-in users away. The
 * client form posts to {@link resetPasswordAction}, which always
 * returns a success-shaped state regardless of whether the email
 * exists (preventing enumeration); the rate limit protects against
 * flooding.
 *
 * @module app/(auth)/reset-password/page
 */
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/');
  return <ResetPasswordForm />;
}
