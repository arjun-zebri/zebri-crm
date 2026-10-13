'use client';

/**
 * Outreach > Analytics: how the campaigns are doing, and which
 * sequences, messages, steps and times are working.
 *
 * Shows the funnel, deliverability, then the comparison tables. A
 * campaign filter narrows everything to one campaign. The filter only
 * appears once there is something to filter.
 *
 * @module features/outreach/views/analytics-view
 */
import { BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { Select } from '@/components/ui/select';

import { useAnalytics, useCampaigns } from '../hooks';

import { DeliverabilityCard } from './analytics/deliverability-card';
import { FunnelStrip } from './analytics/funnel-strip';
import { ReportTables } from './analytics/report-tables';

/** Sentinel for "every campaign". Never an empty string, since Select rejects that. */
const ALL = 'all';

/** Analytics tab. */
export function AnalyticsView() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(ALL);
  const campaignId = selected === ALL ? null : selected;
  const campaigns = useCampaigns();
  const analytics = useAnalytics(campaignId);

  const campaignOptions = [
    { value: ALL, label: 'All campaigns' },
    ...(campaigns.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  // Why: the picker is noise until there are campaigns with sends to compare. A picked campaign
  // keeps it visible, so the founder can always get back to "All campaigns" from an empty result.
  const hasSends = (analytics.data?.funnel.contacted ?? 0) > 0;
  const showPicker = (campaigns.data?.length ?? 0) > 0 && (hasSends || selected !== ALL);

  const filter = (
    <Select
      ariaLabel="Campaign"
      options={campaignOptions}
      value={selected}
      onValueChange={setSelected}
      className="w-56"
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-text-muted">How outreach is performing, and which options are ahead.</p>
        {showPicker && filter}
      </div>
      {analytics.isPending && <Loading label="Loading analytics" />}
      {analytics.isError && (
        <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
      )}
      {analytics.data && analytics.data.funnel.contacted === 0 ? (
        <Empty
          icon={BarChart3}
          title="Nothing sent yet"
          description="Once the first messages go out, the results show up here."
          action={
            <Button variant="outline" onClick={() => router.push('/admin/outreach?view=campaigns')}>
              Go to campaigns
            </Button>
          }
        />
      ) : (
        analytics.data && (
          <>
            <FunnelStrip funnel={analytics.data.funnel} />
            <DeliverabilityCard
              daily={analytics.data.daily}
              bounceRate={analytics.data.bounceRate}
              optOutRate={analytics.data.optOutRate}
            />
            <ReportTables report={analytics.data.report} />
          </>
        )
      )}
    </div>
  );
}
