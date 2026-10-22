import type { ReactNode } from 'react';

/**
 * The top row of every dashboard page, laid out the way Attio heads a
 * page (founder picked Attio's Home, 2026-10-09), in Zebri's own look:
 * the page's pills on the left (Journeys' style, the house tabs), and on
 * the right what the current pill offers (search, filter, New) and then
 * the dashboard's glass icon pill. It runs the page's full width, above
 * the centred content.
 *
 * No visible title: it only repeated the sidebar and the pills (founder,
 * same day). The heading stays for screen readers, as `title`, so the
 * page's section is still named. Its padding matches Home's top row, so
 * the icons sit in the same spot on every page.
 *
 * @example
 * ```tsx
 * <PageBar title={<h1 id="payments-title" className="sr-only">Payments</h1>} tabs={<PillTabs … />} toolbar={<PaymentsToolbar … />} actions={actions} />
 * ```
 *
 * @module app/design-system/v2/pages/dashboard/page-bar
 */

export interface PageBarProps {
  /** The page heading, visually hidden (`sr-only`), with its id for the section's `aria-labelledby`. */
  title: ReactNode;
  /** The page's pills, first on the row. */
  tabs?: ReactNode;
  /** What the current tab offers: search, period, New. */
  toolbar?: ReactNode;
  /** The dashboard's icons, last on the row. */
  actions?: ReactNode;
}

/** The page bar. See {@link PageBarProps}. */
export function PageBar({ title, tabs, toolbar, actions }: PageBarProps) {
  return (
    <header className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2 px-3 pt-3 md:pl-5 md:pr-2">
      {title}
      {tabs ? <div className="min-w-0">{tabs}</div> : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {toolbar}
        {actions}
      </div>
    </header>
  );
}
