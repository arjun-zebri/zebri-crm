/**
 * /proposals/templates/[id]: the template editor route. Full width - it
 * opts out of `ProposalsFrame`'s gutter (see `../../proposals-frame.tsx`)
 * and owns its own scroll (the canvas manages its own viewport).
 *
 * @module app/(dashboard)/proposals/templates/[id]/page
 */
import { notFound } from 'next/navigation';

import { TemplateEditor } from '@/features/proposals';
import { createClient } from '@/lib/supabase/server';

import { proposalLayoutV2Enabled } from '../../flags';

/**
 * Renders the template editor route, gated behind the Proposal Layout v2
 * flag. Next 16: `params` is async. The signed-in user's id is resolved
 * here (the dashboard middleware guarantees one) so the editor can scope
 * its local draft per account - see `editor/local-draft.ts` for why a
 * browser-global key is not safe.
 */
export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!proposalLayoutV2Enabled()) notFound();
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <TemplateEditor templateId={id} userId={user?.id ?? null} />;
}
