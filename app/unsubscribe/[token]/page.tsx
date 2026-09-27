/**
 * Public unsubscribe confirmation page: `GET /unsubscribe/[token]`.
 *
 * No session, no login: the Spam Act Regulations forbid requiring either to
 * opt out of commercial email, so the signed token in the URL
 * ({@link verifyUnsubscribeToken}) is the entire capability. On the
 * middleware `PUBLIC_ROUTES` allow-list (`middleware.ts`), the exact gap
 * that left the questionnaire fill page behind the auth wall before.
 *
 * READ-ONLY BY DESIGN. This is a `GET`, and mailbox providers and corporate
 * link scanners pre-fetch every `GET` link in an email before a person sees
 * it. If loading this page itself unsubscribed the address, a scanner would
 * silently opt people out of mail they never asked to stop. So this page
 * only ever reads: it decodes the token, looks up whether the address is
 * already suppressed, and renders one of three states. The only state that
 * writes anything is a real confirming submit of the form below, which posts
 * to `POST /api/unsubscribe`; see that route's module doc for the full
 * one-click-vs-scanner reasoning. That form needs no client JS, so this
 * stays a plain server component.
 *
 * THREE STATES:
 * 1. **Invalid token**: malformed, tampered, or signed under a rotated
 *    secret. Rendered as a plain "this link isn't valid" message; never
 *    distinguishes "malformed" from "well-formed but wrong signature" so a
 *    forged token attempt learns nothing from the response.
 * 2. **Already unsubscribed**: a fresh DB read (not a query-string flag)
 *    finds the suppression row already there, whether from an earlier visit,
 *    the other partner clicking first, or a reload after confirming. This is
 *    what makes a second visit harmless: there is no form to resubmit, only
 *    a statement of fact.
 * 3. **Not yet suppressed**: the confirm form, one button, one POST. When
 *    the previous POST failed to record (`?error=write_failed`), the form
 *    comes back with a danger callout saying so, rather than silently.
 *
 * @module app/unsubscribe/[token]/page
 */
import { headers } from 'next/headers';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { ipOfHeaders } from '@/lib/api/rate-limit';
import { isAlreadyUnsubscribed } from '@/lib/email/record-unsubscribe';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { createAdminClient } from '@/lib/supabase/admin';

interface PageProps {
  params: Promise<{ token: string }>;
  // Next.js 16: searchParams is a Promise in async server components.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Shared shell every state renders inside, mirroring the other public
 *  surfaces (`/timeline/[token]`, `/book/[token]`): centred column, logo,
 *  no sidebar chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4">
      <div className="w-full max-w-md pt-10 pb-16">
        <div className="pb-8">
          <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function UnsubscribePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const errorParam = typeof query.error === 'string' ? query.error : undefined;

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    // Mirrors every other public-token surface: an invalid token counts
    // toward the shared limiter so scripted enumeration trips the same
    // burst alert here as on `/proposal`, `/contract`, etc.
    await recordInvalidTokenAttempt({ ip: ipOfHeaders(await headers()), surface: 'unsubscribe' });
    return (
      <Shell>
        <h1 className="text-display font-semibold text-text mb-2">This link isn&apos;t valid</h1>
        <p className="text-body text-text-muted">
          It may have been altered when it was copied. If you still want to stop receiving these
          emails, reply to the most recent one and ask directly.
        </p>
      </Shell>
    );
  }

  // The address match is exact (case and whitespace folded), never an
  // ILIKE pattern: see `lib/email/record-unsubscribe.ts`.
  const [alreadyUnsubscribed, { data: couple }] = await Promise.all([
    isAlreadyUnsubscribed(payload),
    createAdminClient().from('couples').select('name').eq('id', payload.cid).maybeSingle(),
  ]);

  const about = couple?.name ? ` about ${couple.name}'s wedding` : '';

  if (alreadyUnsubscribed) {
    return (
      <Shell>
        <h1 className="text-display font-semibold text-text mb-2">You&apos;re unsubscribed</h1>
        <p className="text-body text-text-muted">
          {payload.email} won&apos;t receive any more marketing or automated emails{about}.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-display font-semibold text-text mb-2">Stop these emails?</h1>
      <p className="text-body text-text-muted mb-6">
        {payload.email} will stop receiving marketing and automated emails{about}. Invoices and
        contracts still arrive, and this doesn&apos;t cancel or change anything already booked.
      </p>
      {errorParam === 'write_failed' && (
        <Callout tone="danger" className="mb-6">
          We couldn&apos;t record that just now, so you&apos;re not unsubscribed yet. Please try again.
        </Callout>
      )}
      {errorParam === 'rate_limited' && (
        <Callout tone="warning" className="mb-6">
          Too many attempts from this connection. Wait a minute and try again.
        </Callout>
      )}
      <form method="POST" action="/api/unsubscribe">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="danger">
          Unsubscribe me
        </Button>
      </form>
    </Shell>
  );
}
