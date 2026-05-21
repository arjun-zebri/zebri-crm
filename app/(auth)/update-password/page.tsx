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

import { createClient } from '@/lib/supabase/server';

import { UpdatePasswordForm } from './update-password-form';

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/reset-password');
  return <UpdatePasswordForm />;
}
