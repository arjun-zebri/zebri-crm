import type { ReactNode } from 'react';

/**
 * The dropdown surface and its rows.
 *
 * Every popover menu in the app hand-wrote this: a bordered panel with
 * `py-1`, holding full-width left-aligned rows with their own padding
 * and text size. Filter, Sort and Group-by on the tasks page each had a
 * slightly different version, which is why menu rows never lined up
 * between one dropdown and the next.
 *
 * This is presentation only. Positioning, open state and outside-click
 * dismissal stay with the caller (usually a Radix `Popover.Content` or a
 * hand-managed absolute wrapper), because those differ legitimately.
 *
 * @example
 * ```tsx
 * <MenuPanel>
 *   <MenuItem onClick={clearAll}>Clear filters</MenuItem>
 *   <MenuItem selected={by === 'status'} onClick={() => setBy('status')}>
 *     Status
 *   </MenuItem>
 *   <MenuSeparator />
 *   <MenuItem destructive onClick={remove}>Delete</MenuItem>
 * </MenuPanel>
 * ```
 *
 * @module components/ui/menu
 */

/** Row density. `'sm'` matches a `size="xs"` trigger; `'md'` the rest. */
export type MenuSize = 'sm' | 'md';

/**
 * Panel width. Fixed by default so a menu holding one short option and
 * one holding ten long ones look like the same control.
 *
 * `'auto'` sizes to content and is for menus whose rows are chips or
 * pills rather than text, where a fixed box leaves obvious dead space.
 */
export type MenuWidth = 'sm' | 'md' | 'lg' | 'auto';

export interface MenuPanelProps {
  /** Rows, separators and headings. */
  children: ReactNode;
  /** Panel width. Defaults to `'md'` (224px). */
  width?: MenuWidth;
  /** Extra classes, typically `max-h-*` for a long scrolling list. */
  className?: string;
}

const WIDTH_CLASSES: Record<MenuWidth, string> = {
  sm: 'w-44',
  md: 'w-56',
  lg: 'w-72',
  auto: 'w-max',
};

/**
 * The bordered dropdown surface. Owns width, padding, border and shadow.
 *
 * Width is set here rather than left to the caller for two reasons. A
 * plain block panel stretches to fill whatever it is dropped into, which
 * once made a filter dropdown span the entire viewport. And pure
 * content-sizing swings the other way: a menu with one short option
 * collapses to a stub. A fixed default keeps every dropdown in the app
 * reading as the same control.
 *
 * Use the `width` prop rather than a `w-*` class in `className`: two
 * competing width utilities resolve by Tailwind's own stylesheet order,
 * not by which one the caller wrote last, so an override would not
 * reliably win.
 */
export function MenuPanel({ children, width = 'md', className }: MenuPanelProps) {
  return (
    <div
      role="menu"
      className={`${WIDTH_CLASSES[width]} max-w-[calc(100vw-2rem)] overflow-hidden rounded-control border border-border bg-card py-1 text-body shadow-lg${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps {
  /** Row content. */
  children: ReactNode;
  /** Activate the row. */
  onClick?: () => void;
  /** Marks the current choice: tinted background, stronger text. */
  selected?: boolean;
  /** Destructive action: danger-toned text. */
  destructive?: boolean;
  /** Greys the row out and blocks activation. */
  disabled?: boolean;
  /** Row density. Defaults to `'md'`. */
  size?: MenuSize;
  /** Trailing slot, e.g. a tick or a count. */
  trailing?: ReactNode;
  /** Extra classes, e.g. a responsive `sm:hidden`. */
  className?: string;
}

const ITEM_SIZE: Record<MenuSize, string> = {
  sm: 'px-2.5 py-1.5 text-body gap-2',
  md: 'px-3 py-2 text-body gap-2',
};

/** One selectable row inside a {@link MenuPanel}. */
export function MenuItem({
  children,
  onClick,
  selected = false,
  destructive = false,
  disabled = false,
  size = 'md',
  trailing,
  className,
}: MenuItemProps) {
  // Tone is decided once, here, so a destructive row looks the same in
  // every menu instead of picking its own red.
  const tone = destructive
    ? 'text-danger hover:bg-danger/10'
    : selected
      ? 'bg-surface-emphasis text-text font-medium'
      : 'text-text-muted hover:bg-surface-emphasis hover:text-text';

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-center text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ITEM_SIZE[size]} ${tone}${
        className ? ` ${className}` : ''
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </button>
  );
}

/** A hairline between groups of rows. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

/** A non-interactive label above a group of rows. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-1.5 text-body font-medium text-text-subtle">{children}</div>
  );
}
