'use client';

/**
 * Admin > Outreach: the founder's cold-outreach workspace.
 *
 * One page, six views behind `?view=`. Outreach has its own sidebar entry,
 * so this page owns its title and a single row of tabs. Header, tabs and
 * content share one `max-w-5xl` column, so every view has the same measure.
 *
 * Legacy links are normalised with `router.replace`: `?view=checks` and
 * `?view=pipeline` were folded into Prospects, so an old bookmark lands on
 * the page that now holds that work.
 *
 * @module features/outreach/outreach-view
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { UnderlineTabs, type UnderlineTab } from '@/components/ui/underline-tabs';

import { OutreachHeader } from './outreach-header';
import { AnalyticsView } from './views/analytics-view';
import { CampaignsView } from './views/campaigns-view';
import { ProspectsView } from './views/prospects-view';
import { SequencesView } from './views/sequences-view';
import { SettingsView } from './views/settings-view';
import { TodayView } from './views/today-view';

/** Outreach views. */
export type OutreachViewId = 'today' | 'prospects' | 'sequences' | 'campaigns' | 'analytics' | 'settings';

const VIEWS: UnderlineTab<OutreachViewId>[] = [
  { id: 'today', label: 'Today' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

/**
 * Retired `?view=` values and where they now live. `checks` opens Prospects
 * with nothing open, so it drops any modal params; `pipeline` is the board.
 */
const LEGACY: Record<string, string> = {
  checks: '/admin/outreach?view=prospects',
  pipeline: '/admin/outreach?view=prospects&board=1',
};

function isView(v: string | null): v is OutreachViewId {
  return VIEWS.some((x) => x.id === v);
}

/** The Outreach workspace. */
export function OutreachView() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('view');
  const legacyTarget = raw ? LEGACY[raw] : undefined;

  // Normalise after paint, not during render: the replace is a navigation,
  // and a render-time side effect would run again on every re-render.
  useEffect(() => {
    if (legacyTarget) router.replace(legacyTarget);
  }, [legacyTarget, router]);

  // Show Prospects straight away for a legacy link, so the redirect does not flash Today.
  const view: OutreachViewId = legacyTarget ? 'prospects' : isView(raw) ? raw : 'today';

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-6 flex-1 min-h-0 overflow-y-auto scrollbar-hover">
      <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
        <div className="space-y-4">
          <OutreachHeader view={view} />
          <UnderlineTabs tabs={VIEWS} active={view} onChange={(id) => router.replace(`/admin/outreach?view=${id}`)} ariaLabel="Outreach views" />
        </div>
        {view === 'today' && <TodayView />}
        {view === 'prospects' && <ProspectsView />}
        {view === 'sequences' && <SequencesView />}
        {view === 'campaigns' && <CampaignsView />}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'settings' && <SettingsView />}
      </div>
    </div>
  );
}
