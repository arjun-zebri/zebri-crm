import {
  listUsersWithSubscription,
  getGlobalStats,
} from "@/lib/admin-analytics";
import { AdminTabs } from "./admin-tabs";

export default async function AdminPage() {
  const [users, stats] = await Promise.all([
    listUsersWithSubscription(),
    getGlobalStats(),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          Admin
        </h1>
      </div>

      <AdminTabs users={users} stats={stats} />
    </div>
  );
}
