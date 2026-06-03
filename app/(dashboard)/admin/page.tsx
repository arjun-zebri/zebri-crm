import {
  getAdminDashboard,
  listUsersWithSubscription,
} from '@/lib/admin/admin-analytics';

import { AdminDashboardView } from './admin-dashboard';

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
        <h1 className="text-2xl sm:text-3xl font-semibold text-text">Admin</h1>
      </div>

      <AdminDashboardView users={users} dashboard={dashboard} />
    </div>
  );
}
