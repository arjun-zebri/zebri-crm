/**
 * `POST /api/alerts/client-error`: the browser's error report.
 *
 * Replaces `/api/alerts/slack`, which relayed whatever Slack payload it
 * was sent, unauthenticated, so anyone could post anything to the alerts
 * channel. This route takes a small validated report and builds the
 * message itself. Who is signed in, which browser and which build are
 * filled in here, never trusted from the body.
 *
 * Public on purpose (it sits under `/api/alerts` in the middleware's
 * PUBLIC_ROUTES): a crash on the couple portal or a public invoice is
 * worth knowing about, and those visitors have no session.
 *
 * @module app/api/alerts/client-error/route
 */

import { NextResponse, type NextRequest } from 'next/server';

import { clientErrorReportSchema, describeBrowser, describeBuild, redactPage, sydneyTime } from '@/lib/alerts/error-report';
import { sendAlert } from '@/lib/alerts/send-alert';
import { CLIENT_ERROR_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(CLIENT_ERROR_RATE_LIMITS.report);

/** Accept one report and post it to Slack. Always 204 on a valid report, even if Slack is down. */
export async function POST(request: NextRequest): Promise<Response> {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, clientErrorReportSchema);
  if (!parsed.ok) return parsed.response;
  const report = parsed.data;

  // No session is normal on public pages; a failed read is treated the same.
  let account: string | undefined;
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    account = data.user?.email ?? undefined;
    userId = data.user?.id;
  } catch {
    // Report without an account rather than drop the report.
  }

  await sendAlert({
    type: 'client_error',
    severity: report.kind === 'mutation' ? 'warn' : 'error',
    kind: report.kind,
    message: report.message,
    ...(report.code ? { code: report.code } : {}),
    ...(report.digest ? { digest: report.digest } : {}),
    ...(report.mutation ? { mutation: report.mutation } : {}),
    page: redactPage(report.page),
    ...(account ? { account } : {}),
    ...(userId ? { userId } : {}),
    browser: describeBrowser(request.headers.get('user-agent')),
    build: describeBuild(),
    at: sydneyTime(),
  });

  return new NextResponse(null, { status: 204 });
}
