/**
 * /proposals/templates: orchestrator for the Templates tab.
 *
 * @module app/(dashboard)/proposals/templates/page
 */
import { notFound } from 'next/navigation';

import { proposalLayoutV2Enabled } from '../flags';
import { ProposalsFrame } from '../proposals-frame';

import { TemplatesList } from './templates-list';

/** Renders the Templates tab route, gated behind the Proposal Layout v2 flag. */
export default function TemplatesPage() {
  if (!proposalLayoutV2Enabled()) notFound();
  return (
    <ProposalsFrame>
      <div className="space-y-6">
        <TemplatesList />
      </div>
    </ProposalsFrame>
  );
}
