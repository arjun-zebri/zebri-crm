/**
 * /proposals/[id]/design: the editor on one proposal's own copy of a
 * template design (roadmap R3 §6.1, "Edit"). Full width - it opts out of
 * `ProposalsFrame`'s gutter (see `../../proposals-frame.tsx`) and owns its
 * own scroll (the canvas manages its own viewport), exactly as the
 * template editor route does.
 *
 * @module app/(dashboard)/proposals/[id]/design/page
 */
import { notFound } from 'next/navigation';

import { ProposalEditor } from '@/features/proposals';
import { createClient } from '@/lib/supabase/server';

import { proposalLayoutV2Enabled } from '../../flags';

/**
 * Renders the proposal design route, gated behind the Proposal Layout v2
 * flag. Next 16: `params` is async. The signed-in user's id is resolved
 * here (the dashboard middleware guarantees one) so the editor can scope
 * its local draft per account - see `editor/local-draft.ts` for why a
 * browser-global key is not safe.
 */
export default async function ProposalDesignPage({ params }: { params: Promise<{ id: string }> }) {
  if (!proposalLayoutV2Enabled()) notFound();
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <ProposalEditor proposalId={id} userId={user?.id ?? null} />;
}
