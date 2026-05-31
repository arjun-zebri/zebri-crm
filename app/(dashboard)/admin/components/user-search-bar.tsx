'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type { AdminUser } from '@/lib/admin/admin-analytics';

/**
 * Quick-jump search at the top of the admin page. Filters the loaded
 * `users` list by email or business name (case-insensitive substring)
 * and shows up to 6 matches in a popover-style dropdown. Clicking a
 * match calls `onSelect(userId)` which opens the detail panel — the
 * "support email arrives, open this user in one click" flow.
 */
export function UserSearchBar({
  users,
  onSelect,
}: {
  users: AdminUser[];
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (trimmed.length < 2) return [];
    return users
      .filter((u) => {
        return (
          u.email.toLowerCase().includes(trimmed) ||
          u.business_name.toLowerCase().includes(trimmed) ||
          u.display_name.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 6);
  }, [trimmed, users]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative max-w-md">
      <div className="relative">
        <Search
          size={14}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Defer the close so a click on a match still fires before
          // the popover unmounts (mousedown→click ordering).
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Search by email or business name"
          className="pl-9"
          size="sm"
        />
      </div>
      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto bg-surface border border-border rounded-control shadow-lg"
        >
          {matches.map((m) => (
            <li
              key={m.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                // Prevent input blur from firing before the click.
                e.preventDefault();
                handleSelect(m.id);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-surface-emphasis"
            >
              <p className="text-sm text-text truncate">
                {m.display_name || m.business_name || m.email}
              </p>
              <p className="text-xs text-text-muted truncate">{m.email}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
