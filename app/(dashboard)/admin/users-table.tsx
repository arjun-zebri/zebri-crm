"use client";

import { useState, useTransition } from "react";
import { enterShadow } from "@/app/admin/actions";

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  business_name: string;
  account_type: string;
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.display_name.toLowerCase().includes(q) ||
      u.business_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleEnterShadow = (userId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await enterShadow(userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to enter shadow mode");
        setConfirmId(null);
      }
    });
  };

  return (
    <div>
      {error && (
        <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, business, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Business
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Email
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No users found
                </td>
              </tr>
            )}
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {user.display_name || "—"}
                  {user.account_type === "admin" && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {user.business_name || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3 text-right">
                  {confirmId === user.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-500 text-xs">
                        Enter Shadow Mode?
                      </span>
                      <button
                        onClick={() => handleEnterShadow(user.id)}
                        disabled={isPending}
                        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-2.5 py-1 rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        {isPending ? "Entering…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(user.id)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      Enter Shadow Mode
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">{users.length} users total</p>
    </div>
  );
}
