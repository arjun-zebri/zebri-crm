import type { ReactNode } from 'react';

/**
 * The frame every dashboard page but Home sits in: the page's
 * {@link PageBar} across the top, then the content in a centred column,
 * the same width on every page. Nothing paints a background, so the
 * gradient runs under the whole page.
 *
 * Why (2026-10-09, after a day of rejected layouts): a big title and
 * floating icons gave every width we tried an unfinished look. The
 * founder picked Attio's Home: a thin bar heads the page and a hairline
 * marks the sidebar's edge, so the centred column reads as deliberate.
 * Attio's white panel was dropped the same day so the gradient shows.
 * Never add a width variant.
 *
 * @example
 * ```tsx
 * <PageFrame labelledBy="documents-title" bar={<PageBar title={…} toolbar={…} actions={actions} />}>
 *   …
 * </PageFrame>
 * ```
 *
 * @module app/design-system/v2/pages/dashboard/page-frame
 */

export interface PageFrameProps {
  /** The id of the page's heading, which names the section. */
  labelledBy: string;
  /** The page's bar, which runs the page's full width above the column. */
  bar: ReactNode;
  /** Added to the outer section, e.g. `md:h-full` for a page that scrolls only part of itself. */
  className?: string | undefined;
  children: ReactNode;
}

/** The page frame. See {@link PageFrameProps}. */
export function PageFrame({ labelledBy, bar, className, children }: PageFrameProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`relative flex flex-1 flex-col${className ? ` ${className}` : ''}`}
    >
      {bar}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-8 pt-6 md:min-h-0 md:px-6">
        {children}
      </div>
    </section>
  );
}
