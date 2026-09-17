/**
 * /proposals/settings: Phase 1 placeholder for the account defaults
 * (spec §5.1: password, PDF download, link preview, expiry, deposit);
 * the form arrives in Phase 4.
 *
 * @module app/(dashboard)/proposals/settings/page
 */
import { Settings } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

import { proposalLayoutV2Enabled } from '../flags';
import { ProposalsFrame } from '../proposals-frame';
import { ProposalsNav } from '../proposals-nav';

/** Renders the Settings tab route (Phase 1 placeholder), gated behind the Proposal Layout v2 flag. */
export default function ProposalsSettingsPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <ProposalsFrame>
      <div className="space-y-6">
        <PageHeader title="Proposals" />
        <ProposalsNav active="settings" />
        <Empty
          icon={Settings}
          title="Proposal defaults are coming"
          description="Password protection, PDF download, link preview, expiry and deposit defaults for every new proposal."
        />
      </div>
    </ProposalsFrame>
  );
}
