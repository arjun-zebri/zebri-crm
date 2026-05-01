import { listUsers } from "@/app/admin/actions";
import { UsersTable } from "./users-table";

export default async function AdminPage() {
  const users = await listUsers();

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <h1 className="text-3xl font-semibold mb-8">Admin</h1>
      <UsersTable users={users} />
    </div>
  );
}
