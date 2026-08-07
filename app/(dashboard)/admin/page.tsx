import { PageHeader } from '@/components/ui/page-header';
import {
  getAdminDashboard,
  listUsersWithSubscription,
} from '@/lib/admin/admin-analytics';

import { AdminDashboardView } from './admin-dashboard';

/**
 * Never prerender this page.
 *
 * Every other dashboard page reaches Supabase through the cookie-backed
 * server client, which awaits `cookies()` and so marks its route dynamic
 * for free. This one uses the **service-role** client instead (it reads
 * across every tenant), so it touches no dynamic API and Next considers
 * it statically analysable.
 *
 * That was harmless until `(dashboard)/loading.tsx` landed: a
 * `loading.tsx` creates an implicit Suspense boundary, which stops
 * `useSearchParams()` in `AdminDashboardView` from forcing the route
 * dynamic. `/admin` flipped from `ƒ` to `○` and the build started
 * running these two queries against whatever `NEXT_PUBLIC_SUPABASE_URL`
 * pointed at — in CI, a dummy hostname, so `next build` died on
 * `ENOTFOUND`.
 *
 * There is nothing here worth prerendering: it is per-request admin data
 * behind an auth gate.
 */
export const dynamic = 'force-dynamic';

/**
 * /admin — single-pane founder dashboard (Phase 13.1 redesign).
 * Fetches the dashboard aggregator + the user list (the latter
 * still powers the email/business search bar and the per-user
 * detail panel). RLS-bypassing service-role queries inside both
 * helpers; the route is gated by middleware via `isAdmin(user)`.
 */
export default async function AdminPage() {
  const [users, dashboard] = await Promise.all([
    listUsersWithSubscription(),
    getAdminDashboard(),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 flex-shrink-0">
        <PageHeader title="Admin" />
      </div>

      <AdminDashboardView users={users} dashboard={dashboard} />
    </div>
  );
}
