/**
 * Accepts a report from the in-app Feedback pill.
 *
 * Writes the durable `bug_reports` row first, then files the Notion ticket.
 * The response is 200 either way: once the row is saved the MC's work is safe,
 * and telling them it failed because a third party was down would only make
 * them retype it. When Notion refused the ticket the response simply carries
 * no reference and Slack gets the full text.
 *
 * @module app/api/bug-reports/submit/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { BUG_REPORT_RATE_LIMITS, inMemoryLimiter } from '@/lib/api/rate-limit';
import { parseFormDataBody } from '@/lib/api/validate';
import { syncReportToNotion } from '@/lib/bug-reports/submit';
import { summariseUserAgent } from '@/lib/bug-reports/user-agent';
import { ALLOWED_SCREENSHOT_TYPES, MAX_SCREENSHOT_BYTES } from '@/lib/notion/file-upload';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(BUG_REPORT_RATE_LIMITS.submit);

/**
 * Only the fields the browser is the authority on.
 *
 * The reporter, the user agent and the build SHA are all read server-side so a
 * crafted request cannot file a ticket under someone else's name.
 */
const bodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(5000),
  reportType: z.enum(['Bug', 'Feature', 'Improvement']),
  pageUrl: z.string().trim().url().max(2000),
  routePath: z.string().trim().min(1).max(500),
  viewportWidth: z.coerce.number().int().positive().max(20000),
  viewportHeight: z.coerce.number().int().positive().max(20000),
  screenshot: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_SCREENSHOT_BYTES, 'Screenshot must be 5MB or smaller')
    .refine(
      (f) => (ALLOWED_SCREENSHOT_TYPES as readonly string[]).includes(f.type),
      'Screenshot must be a PNG, JPEG or WebP image',
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Shadow mode files tickets that look like they came from the MC but did
  // not. The pill is hidden client-side; this is the half that cannot be
  // bypassed by opening devtools.
  if (request.cookies.get('zebri_shadow_admin_id')) {
    return NextResponse.json(
      { error: 'Feedback cannot be sent while viewing as another user' },
      { status: 403 },
    );
  }

  const { allowed, retryAfter } = await limiter.check(user.id);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseFormDataBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const userAgent = request.headers.get('user-agent');
  // `display_name` lives in user_metadata, which the user can write. That is
  // fine for a display name; the email beside it comes from the session and
  // is the part that identifies them.
  const displayName =
    (user.user_metadata?.['display_name'] as string | undefined) ??
    user.email?.split('@')[0] ??
    'Unknown';
  const reporter = user.email ? `${displayName} (${user.email})` : displayName;
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local';

  const { data: row, error } = await supabase
    .from('bug_reports')
    .insert({
      user_id: user.id,
      title: body.title,
      description: body.description,
      report_type: body.reportType,
      screenshot_filename: body.screenshot?.name ?? null,
      page_url: body.pageUrl,
      route_path: body.routePath,
      user_agent: userAgent,
      viewport_width: body.viewportWidth,
      viewport_height: body.viewportHeight,
      build_sha: buildSha,
    })
    .select('id')
    .single();

  if (error || !row) {
    // Nothing was saved, so this is the one case where the MC has to be told.
    return NextResponse.json({ error: 'Could not save your feedback' }, { status: 500 });
  }

  const result = await syncReportToNotion(
    supabase,
    {
      reportId: row.id,
      title: body.title,
      description: body.description,
      reportType: body.reportType,
      reporter,
      pageUrl: body.pageUrl,
      routePath: body.routePath,
      browser: summariseUserAgent(userAgent),
      viewport: `${body.viewportWidth} x ${body.viewportHeight}`,
      buildSha,
      account: user.email ?? displayName,
    },
    body.screenshot ?? null,
  );

  return NextResponse.json({ ok: true, ticketRef: result.ticketRef });
}
