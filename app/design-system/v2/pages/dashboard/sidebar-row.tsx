import type { LucideIcon } from 'lucide-react';

/**
 * One sidebar link: an icon and a label. The row keeps the same shape
 * open and collapsed (the icon never moves), and the label fades as the
 * rail narrows, so the width change reads as one smooth motion instead
 * of the layout jumping between two states.
 *
 * With `onClick` it is a button instead (Blocks opens a dialog
 * rather than going anywhere), styled the same.
 *
 * @module app/design-system/v2/pages/dashboard/sidebar-row
 */

export interface SidebarRowProps {
  label: string;
  /** Leave out for a text-only row (chat history). */
  icon?: LucideIcon | undefined;
  collapsed: boolean;
  current?: boolean;
  /** Makes the row a button that opens something in place. */
  onClick?: (() => void) | undefined;
  /** For a page link: switches the page in place instead of following the href. */
  onNavigate?: (() => void) | undefined;
  /** A number at the row's right edge: how many need looking at. Hidden at 0. */
  count?: number | undefined;
  /** Extra classes on the row, e.g. the rise-in for a just-added tool. */
  className?: string | undefined;
  /**
   * Shown but not open yet: greyed, and does nothing when picked. A new
   * account's pages open one at a time as setup reaches them, so the MC
   * is never pulled away from the one thing to do next.
   */
  locked?: boolean | undefined;
}

/** Fades a label out while the rail collapses. Shared with the user row. */
export const fadeLabel = (collapsed: boolean) =>
  `min-w-0 truncate transition-opacity duration-200 motion-reduce:transition-none ${collapsed ? 'opacity-0' : 'opacity-100 delay-100'}`;

/** A sidebar link. See {@link SidebarRowProps}. */
export function SidebarRow({ label, icon: Icon, collapsed, current = false, count, onClick, onNavigate, className, locked = false }: SidebarRowProps) {
  // The page on screen is never shown locked, even while its row would be.
  const shut = locked && !current;
  const shared = {
    // Collapsed, the label is invisible, so the row needs its name
    // spelled out, and a hover title stands in for the missing text.
    'aria-label': collapsed ? label : undefined,
    title: shut ? `${label} opens as you set up` : collapsed ? label : undefined,
    className: `flex h-9 w-full items-center gap-3 whitespace-nowrap rounded-button px-3 type-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
      current
        ? 'bg-zebra-950/5 font-medium text-zebra-950'
        : shut
          ? 'cursor-default text-zebra-300'
          : 'text-zebra-600 hover:bg-zebra-950/5 hover:text-zebra-950'
    }${className ? ` ${className}` : ''}`,
  };
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" /> : null}
      <span className={fadeLabel(collapsed)}>{label}</span>
      {count && !collapsed ? <span className="ml-auto pl-2 tabular-nums text-zebra-400">{count}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" aria-haspopup="dialog" aria-disabled={shut || undefined} onClick={shut ? undefined : onClick} {...shared}>
      {content}
    </button>
  ) : (
    <a
      href="#"
      aria-current={current ? 'page' : undefined}
      aria-disabled={shut || undefined}
      onClick={(e) => {
        e.preventDefault();
        if (!shut) onNavigate?.();
      }}
      {...shared}
    >
      {content}
    </a>
  );
}
