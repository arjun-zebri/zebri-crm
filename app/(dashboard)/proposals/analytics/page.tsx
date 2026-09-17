/**
 * /proposals/analytics: Phase 1 placeholder for the section-level
 * engagement view (spec §5.1); the data arrives in Phase 5.
 *
 * @module app/(dashboard)/proposals/analytics/page
 */
import { BarChart3 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

import { proposalLayoutV2Enabled } from '../flags';
import { ProposalsFrame } from '../proposals-frame';
import { ProposalsNav } from '../proposals-nav';

/** Renders the Analytics tab route (Phase 1 placeholder), gated behind the Proposal Layout v2 flag. */
export default function ProposalsAnalyticsPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <ProposalsFrame>
      <div className="space-y-6">
        <PageHeader title="Proposals" />
        <ProposalsNav active="analytics" />
        <Empty
          icon={BarChart3}
          title="Section-level analytics are coming"
          description="Time per section, drop-off and device split for every proposal you send."
        />
      </div>
    </ProposalsFrame>
  );
}
