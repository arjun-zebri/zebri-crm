import type { ReactNode } from 'react';

/**
 * The one-line top bar every dashboard page but Home shares: the title,
 * the page's tabs beside it, then the tab's toolbar and the dashboard's
 * icons pushed to the right edge. One line, not a title row over a tabs
 * row, so the page's content starts higher and every page's chrome
 * lines up. Every button and field is the same 36px as the icon panel
 * at the end of the row, so the right side reads as one set. A little
 * room under the bar (on top of the page's own gap) separates the chrome
 * from the content. Wraps on
 * narrow screens: the toolbar drops under the title
 * and tabs rather than squeezing them.
 *
 * @example
 * ```tsx
 * <PageBar title={<h1 id="payments-title" className="type-title text-zebra-950">Payments</h1>} tabs={<Tabs … />} toolbar={<PaymentsToolbar … />} actions={actions} />
 * ```
 *
 * @module app/design-system/v2/pages/dashboard/page-bar
 */

export interface PageBarProps {
  /** The page heading, with its id for the section's `aria-labelledby`. */
  title: ReactNode;
  tabs: ReactNode;
  /** What the current tab offers: search, period, New. */
  toolbar?: ReactNode;
  /** The dashboard's top-right icons. */
  actions?: ReactNode;
}

/** The page bar. See {@link PageBarProps}. */
export function PageBar({ title, tabs, toolbar, actions }: PageBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-10 gap-y-3 pb-4">
      <div className="flex min-w-0 items-center gap-x-10 gap-y-3 max-sm:w-full max-sm:flex-wrap">
        {title}
        {tabs}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {toolbar}
        {actions}
      </div>
    </header>
  );
}
