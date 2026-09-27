/**
 * Second-factor step of sign-in (Phase 4, Task 23).
 *
 * Reached after a password sign-in by an MC with two-factor sign-in on,
 * either straight from `loginAction` or from the middleware gate when an
 * aal1 session asks for a dashboard route. Server component: sends a
 * signed-out visitor to /login and a session that owes nothing onward to
 * `next`, so the screen only ever shows to someone who needs it.
 *
 * @module app/(auth)/login/mfa/page
 */
import { redirect } from 'next/navigation';

import { needsSecondFactor } from '@/lib/auth/mfa';
import { sameOriginPathSchema } from '@/lib/auth/schemas';
import { createClient } from '@/lib/supabase/server';

import { SecondFactorScreen } from './second-factor-screen';

/** `next` only when it is a safe same-origin path (see sameOriginPathSchema). */
function safeNext(raw: string | undefined): string | undefined {
  return raw && sameOriginPathSchema.safeParse(raw).success ? raw : undefined;
}

export default async function SecondFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  // Token read after getUser() validated it; see lib/auth/mfa for why the
  // factor list comes from `user` and not from this session object.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!needsSecondFactor(user, session?.access_token)) redirect(next ?? '/');

  return next ? <SecondFactorScreen next={next} /> : <SecondFactorScreen />;
}
