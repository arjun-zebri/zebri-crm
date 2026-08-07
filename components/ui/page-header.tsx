import type { ReactNode } from 'react';

/**
 * The title row at the top of a dashboard page.
 *
 * Every page used to hand-write this: a flex row holding an `<h1>`, an
 * optional record count, and optional right-aligned actions. Ten pages
 * did it five different ways, which is why page titles drifted between
 * `text-3xl`, `text-2xl sm:text-3xl` and `text-display`, and between
 * `text-gray-900` and `text-text`.
 *
 * Page padding is deliberately not handled here. Pages own their own
 * scroll container and gutters, and those differ legitimately between a
 * full-height calendar and a scrolling list.
 *
 * @example
 * ```tsx
 * <PageHeader title="Couples" count={couples.length} actions={<NewCoupleButton />} />
 * <PageHeader title="Calendar" />
 * ```
 *
 * @module components/ui/page-header
 */

export interface PageHeaderProps {
  /** Page title. Rendered as the page's single `<h1>`. */
  title: ReactNode;
  /**
   * Record count, rendered as "N total" beside the title. Omit when the
   * page has nothing countable. Ignored when `meta` is set.
   */
  count?: number;
  /** Custom meta slot beside the title, for anything that is not a count. */
  meta?: ReactNode;
  /** Right-aligned controls, e.g. a mobile-only add button. */
  actions?: ReactNode;
  /** Extra classes on the row, for page-specific spacing. */
  className?: string;
}

/**
 * Token-driven page title row. See {@link PageHeaderProps}.
 *
 * The title is `text-2xl` below the `sm` breakpoint and `text-display`
 * above it: a 30px title eats an unreasonable share of a 393px phone
 * screen, and the two pages that already shrank it read better for it.
 */
export function PageHeader({ title, count, meta, actions, className }: PageHeaderProps) {
  const metaSlot =
    meta ?? (count === undefined ? null : <span className="text-body text-text-subtle">{count} total</span>);

  return (
    <div className={`flex items-center justify-between${className ? ` ${className}` : ''}`}>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-text sm:text-display">{title}</h1>
        {metaSlot}
      </div>
      {actions}
    </div>
  );
}
