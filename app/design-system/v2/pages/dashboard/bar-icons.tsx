import type { ReactNode } from 'react';

import { Panel } from '@/components/ui-v2/panel';

/**
 * A page's own actions in the page bar (Filter, New client, New invoice):
 * bare icons in one glass pill, the same material and size as the
 * dashboard's calendar and bell beside it.
 * Chosen from the page bar options (user, 2026-10-16, option D): a
 * white Filter box and a solid green New button were the heaviest things
 * on a page that is otherwise plain rows, so the bar keeps only the
 * search as a field and every action as an icon.
 *
 * Children are `Button variant="ghost" square` with an `aria-label`,
 * which names it in a tooltip too, except the + (New client, New
 * invoice…), which needs none (user, 2026-10-16). A popover's trigger
 * goes straight in (`asChild`), so the 30px size below reaches its
 * button too.
 *
 * @example
 * ```tsx
 * <BarIcons>
 *   <Button variant="ghost" square aria-label="New client" tooltip={false} onClick={onNew}>
 *     <PlusIcon aria-hidden="true" className="size-4" />
 *   </Button>
 * </BarIcons>
 * ```
 *
 * @module app/design-system/v2/pages/dashboard/bar-icons
 */
export function BarIcons({ children }: { children: ReactNode }) {
  return (
    // 36px tall with its border, as the dashboard's icon pill (`top-actions.tsx`) is.
    <Panel className="flex items-center gap-0.5 p-0.5 [&>button]:size-[1.875rem]">{children}</Panel>
  );
}
