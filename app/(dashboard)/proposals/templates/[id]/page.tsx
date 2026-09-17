/**
 * /proposals/templates/[id]: the template editor route. Full width - it
 * opts out of `ProposalsFrame`'s gutter (see `../../proposals-frame.tsx`)
 * and owns its own scroll (the canvas manages its own viewport).
 *
 * @module app/(dashboard)/proposals/templates/[id]/page
 */
import { notFound } from 'next/navigation';

import { TemplateEditor } from '@/features/proposals';

import { proposalLayoutV2Enabled } from '../../flags';

/** Renders the template editor route, gated behind the Proposal Layout v2 flag. Next 16: `params` is async. */
export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!proposalLayoutV2Enabled()) notFound();
  const { id } = await params;
  return <TemplateEditor templateId={id} />;
}
