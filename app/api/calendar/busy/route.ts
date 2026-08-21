/**
 * Owner-scoped free/busy intervals endpoint for the MC's calendar grid.
 *
 * Signed-in only. Returns busy events WITH TITLES merged across all active external
 * calendar connections (Google Calendar, Microsoft Graph) plus Zebri bookings.
 *
 * CRITICAL: Titles are for authenticated dashboard display ONLY. The public booking
 * surfaces (app/api/booking/slots/route.ts and lib/booking/availability.ts) MUST
 * continue using getBusyIntervals (anonymous free/busy, no titles). Why: a couple
 * browsing an MC's public booking link must never learn anything about that MC's
 * private calendar content. The only visibility is time availability, not what
 * occupies that time. If you unify these paths to use getBusyEvents, you create
 * a privacy leak where private event titles become observable to unauthorised users.
 *
 * Failure posture for this endpoint (FAIL SOFT) is deliberately OPPOSITE to
 * the public booking surfaces (which fail CLOSED). The reason: the public slots
 * API risks double-booking a real couple if we offer a slot we cannot verify,
 * so it throws and fails hard. Here, the MC is looking at their own calendar
 * for UX (rendering the grid), so an outage at Google (or Microsoft) must not
 * blank their whole day. Instead, we catch FreeBusyUnavailableError and return
 * 200 with `{ busy: [], unavailable: true }` so the grid still renders with a
 * quiet "check your external calendar" notice. This trade-off (preferring
 * incomplete data over a hard error) is the right one for owner-only reads;
 * readers who disagree should read the routing logic before "fixing" this to
 * throw.
 *
 * @module app/api/calendar/busy/route
 */
import { NextRequest, NextResponse } from 'next/server';

import { parseSearchParams } from '@/lib/api/validate';
import { FreeBusyUnavailableError, getBusyEvents } from '@/lib/calendar/free-busy';
import { createClient } from '@/lib/supabase/server';

import { busyQuerySchema } from '../busy-schema';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const parsed = parseSearchParams(request, busyQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { from, to } = parsed.data;

  const range = {
    start: new Date(`${from}T00:00:00Z`),
    end: new Date(`${to}T23:59:59Z`),
  };

  try {
    const busy = await getBusyEvents(supabase, user.user.id, range);
    return NextResponse.json({ busy, unavailable: false });
  } catch (err) {
    // FAIL SOFT: if free/busy read fails, return empty busy list with a flag
    // so the UI can show a quiet notice. See module comment for the reasoning
    // behind this inversion vs the public booking surface.
    if (err instanceof FreeBusyUnavailableError) {
      return NextResponse.json({ busy: [], unavailable: true });
    }
    throw err;
  }
}
