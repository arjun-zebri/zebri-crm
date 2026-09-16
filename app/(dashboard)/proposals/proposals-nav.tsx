'use client';

/**
 * Segmented nav for the Proposals feature (spec D7, §5.1): Proposals,
 * Templates, Analytics, Settings. Link-based tabs (each is a route) in the
 * same tablist idiom the Workflows page uses. Hidden entirely while the
 * Proposal Layout v2 flag is off, so production keeps today's single list.
 *
 * @module app/(dashboard)/proposals/proposals-nav
 */
import Link from 'next/link';

import { proposalLayoutV2Enabled } from './flags';

/** A route the nav can point at. */
export type ProposalsTab = 'proposals' | 'templates' | 'analytics' | 'settings';

const TABS: ReadonlyArray<{ key: ProposalsTab; label: string; href: string }> = [
  { key: 'proposals', label: 'Proposals', href: '/proposals' },
  { key: 'templates', label: 'Templates', href: '/proposals/templates' },
  { key: 'analytics', label: 'Analytics', href: '/proposals/analytics' },
  { key: 'settings', label: 'Settings', href: '/proposals/settings' },
];

/** Props for {@link ProposalsNav}. */
export interface ProposalsNavProps {
  /** Which tab corresponds to the current route. */
  active: ProposalsTab;
}

/**
 * The Proposals feature's tab strip. Renders nothing while
 * {@link proposalLayoutV2Enabled} is false, so today's `/proposals` page is
 * unchanged in production until every phase lands.
 */
export function ProposalsNav({ active }: ProposalsNavProps) {
  if (!proposalLayoutV2Enabled()) return null;
  return (
    <div role="tablist" aria-label="Proposals sections" className="flex items-center gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
            active === t.key ? 'border-brand-fg text-text' : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
