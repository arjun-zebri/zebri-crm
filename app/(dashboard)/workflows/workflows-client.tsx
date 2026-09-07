'use client';

/**
 * The Workflows page shell: the two tabs and the shared data hook.
 *
 * Upcoming is the default because it is the MC's daily view: what is
 * due across every couple, and what is coming. Templates is the library
 * behind it.
 *
 * @module app/(dashboard)/workflows/workflows-client
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PageHeader } from '@/components/ui/page-header';

import { useWorkflowLibrary } from './use-workflow-library';
import { WorkflowsQueue } from './workflows-queue';
import { WorkflowsTemplates } from './workflows-templates';

/** Which tab is showing. */
export type WorkflowsTab = 'queue' | 'templates';

// Tab keys stay `queue` and `templates`: both are in bookmarks and in
// the redirects from the retired /tasks and /automations routes. Only
// the labels changed.
//
// "Upcoming" rather than "Today" because most of what makes a wedding go
// well is decided in the fortnight before it, and a tab called Today
// invites a list that hides exactly that. "Workflows" rather than
// "Templates" because the sidebar already has a Templates page, for
// documents and emails, and two Templates in one app is one too many.
const TABS: { key: WorkflowsTab; label: string }[] = [
  { key: 'queue', label: 'Upcoming' },
  { key: 'templates', label: 'Workflows' },
];

export interface WorkflowsClientProps {
  initialTab: WorkflowsTab;
  /** The MC's IANA timezone, for the queue's relative due labels. */
  timezone: string;
}

/** Tab shell for /workflows. See {@link WorkflowsClientProps}. */
export function WorkflowsClient({ initialTab, timezone }: WorkflowsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<WorkflowsTab>(initialTab);
  const library = useWorkflowLibrary();

  // Keep the tab in the URL so a reload, a bookmark and the browser back
  // button all land where the MC expects.
  const selectTab = useCallback(
    (next: WorkflowsTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`/workflows?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <PageHeader title="Workflows" />

      <div
        role="tablist"
        aria-label="Workflows views"
        className="flex items-center gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => selectTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
              tab === t.key
                ? 'border-brand-fg text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* The tab body owns the rest of the viewport. Both tabs use the
          same shell inside it: a toolbar that stays put and a body that
          scrolls to the bottom of the screen. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'templates' ? (
          <WorkflowsTemplates library={library} />
        ) : (
          <WorkflowsQueue timezone={timezone} />
        )}
      </div>
    </div>
  );
}
