import { OutreachView } from '@/features/outreach';

/**
 * Per-request admin data behind an auth gate; see the note on
 * `/admin/page.tsx` for why this must never prerender.
 */
export const dynamic = 'force-dynamic';

/**
 * /admin/outreach: celebrant cold outreach (spec
 * docs/superpowers/specs/2026-10-11-admin-outreach-design.md).
 * Middleware gates `/admin*` to admins; every action re-checks. The
 * title row lives in the client view, which needs Today's counts.
 */
export default function AdminOutreachPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OutreachView />
    </div>
  );
}
