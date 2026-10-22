import { useState } from 'react';

/**
 * Which items in a list are still unread, and a way to mark one (or all)
 * read. Held above the popover so the icon's dot and the panel's dots
 * always agree. It remembers what was read rather than what is unread,
 * so an item that arrives later (a new account's test client replying)
 * comes in unread.
 *
 * @module app/design-system/v2/pages/dashboard/use-unread
 */
export function useUnread(items: readonly { id: string; unread: boolean }[]) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const unread: ReadonlySet<string> = new Set(items.filter((i) => i.unread && !seen.has(i.id)).map((i) => i.id));
  /** Mark `id` read, or everything with no id. */
  const read = (id?: string) => setSeen((s) => new Set([...s, ...(id === undefined ? items.map((i) => i.id) : [id])]));
  return { unread, read };
}
