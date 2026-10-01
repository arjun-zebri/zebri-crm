'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Design system v2 document page (preview): a sheet of A4 paper for
 * showing a document exactly as it prints or downloads (an invoice, a
 * contract). The page is laid out at A4's real size on screen, 794 by
 * 1123 CSS pixels (210 by 297mm at 96dpi), then scaled down as a whole
 * to the width it is given, so type, margins and line breaks keep their
 * true proportions instead of reflowing like a web card. It never
 * scales up past real size. Anything longer than one page is cut at the
 * bottom edge, as a first page would be.
 *
 * Lay the content out for the full 794px page (margins of about 64px
 * read as a printed document's).
 *
 * @example
 * ```tsx
 * <DocumentPage aria-label="Invoice #1040">
 *   <div className="p-16">…</div>
 * </DocumentPage>
 * ```
 *
 * @module components/ui-v2/document-page
 */

/** A4 at 96dpi. */
export const A4 = { width: 794, height: 1123 } as const;

export interface DocumentPageProps {
  /** Names the document for screen readers ("Invoice #1040"). */
  'aria-label': string;
  children: ReactNode;
}

/** v2 document page. See {@link DocumentPageProps}. */
export function DocumentPage({ children, ...aria }: DocumentPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  // Measured before paint, so the page never flashes at full size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / A4.width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ '--s': scale ?? 0 } as CSSProperties}
      className={`relative mx-auto h-[calc(1123px*var(--s))] w-full max-w-[794px] ${scale === null ? 'invisible' : ''}`}
    >
      <article
        {...aria}
        className="absolute left-0 top-0 h-[1123px] w-[794px] origin-top-left scale-[var(--s)] overflow-hidden rounded-check bg-field text-zebra-950 shadow-lg ring-1 ring-zebra-950/5"
      >
        {children}
      </article>
    </div>
  );
}
