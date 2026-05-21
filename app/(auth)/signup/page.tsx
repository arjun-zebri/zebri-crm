/**
 * Signup page.
 *
 * Server component: redirects already-logged-in users to the
 * dashboard. The actual form logic lives in {@link SignupForm}.
 *
 * @module app/(auth)/signup/page
 */
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/');
  return <SignupForm />;
}
