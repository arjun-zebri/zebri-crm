'use client';

/**
 * One muted line for pages that are not the setup page: how many required
 * things are left, with a link to the Today setup guide. Renders nothing
 * once every required row is done, so a finished account sees no noise.
 *
 * Pass `items` when the page already has the readiness snapshot; otherwise
 * the line reads the shared readiness query itself (same cache entry).
 *
 * @module features/outreach/views/readiness/setup-summary-link
 */
import Link from 'next/link';

import { useReadiness } from '@/features/outreach/hooks';
import { requiredMissing, type ReadinessItem } from '@/lib/outreach/readiness';

/** Props for {@link SetupSummaryLink}. */
export interface SetupSummaryLinkProps {
  /** Readiness rows from the page's snapshot. Omit to read the shared query. */
  items?: ReadinessItem[] | undefined;
}

/** The summary line. Optional rows never count. */
export function SetupSummaryLink({ items }: SetupSummaryLinkProps = {}) {
  const readiness = useReadiness();
  const rows = items ?? readiness.data?.items;
  if (!rows) return null;
  const missing = requiredMissing(rows).length;
  if (missing === 0) return null;

  return (
    <p className="text-body text-text-muted">
      {missing} {missing === 1 ? 'thing' : 'things'} to set up before campaigns can send ·{' '}
      <Link href="/admin/outreach?view=today" className="text-text underline underline-offset-4 hover:text-text-muted">
        Finish setup →
      </Link>
    </p>
  );
}
