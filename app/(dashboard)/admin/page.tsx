import {
  listUsersWithSubscription,
  getGlobalStats,
} from '@/lib/admin/admin-analytics';
import { getOpsSnapshot } from '@/lib/admin/ops-signals';
import { AdminTabs } from "./admin-tabs";

export default async function AdminPage() {
  const [users, stats, ops] = await Promise.all([
    listUsersWithSubscription(),
    getGlobalStats(),
    getOpsSnapshot(),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 md:px-[3.75rem] pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text">
          Admin
        </h1>
      </div>

      <AdminTabs users={users} stats={stats} ops={ops} />
    </div>
  );
}
