/**
 * /proposals/design/new: the design editor for a proposal that does not
 * exist yet. "Make edits" in the send modal routes here with the template,
 * the couple and the expiry it settled on, and the row is created by the
 * first real change (see `./new-proposal-design.tsx`).
 *
 * The path cannot collide with `/proposals/[id]`: Next.js matches static
 * segments before dynamic ones, and this route is two segments deep
 * (`design/new`) while `[id]` is one and `[id]/design` ends on the literal
 * `design`, not `new`. There is deliberately no page at `/proposals/design`
 * itself, so nothing here shadows a real proposal id.
 *
 * Full width, like the other two editor routes: it opts out of
 * `ProposalsFrame`'s gutter and owns its own scroll.
 *
 * @module app/(dashboard)/proposals/design/new/page
 */
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { proposalLayoutV2Enabled } from '../../flags';

import { NewProposalDesign } from './new-proposal-design';

/** Both ids come off the URL, so a malformed one is a 404 rather than a query that cannot match. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `YYYY-MM-DD`, the shape `create-from-template.ts` accepts. Anything else is dropped rather than refused: the defaults are a fine answer. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Props Next.js hands the route. Next 16: `searchParams` is async. */
interface NewProposalDesignPageProps {
  searchParams: Promise<{ template?: string; couple?: string; expires?: string }>;
}

/**
 * Renders the uncreated-proposal editor, gated behind the Proposal Layout
 * v2 flag. The signed-in user's id is resolved here (the dashboard
 * middleware guarantees one) so the editor can scope its local draft per
 * account - see `editor/local-draft.ts` for why a browser-global key is
 * not safe.
 */
export default async function NewProposalDesignPage({ searchParams }: NewProposalDesignPageProps) {
  if (!proposalLayoutV2Enabled()) notFound();
  const { template, couple, expires } = await searchParams;
  if (!template || !couple || !UUID.test(template) || !UUID.test(couple)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <NewProposalDesign
      templateId={template}
      coupleId={couple}
      expiresAt={expires && ISO_DATE.test(expires) ? expires : null}
      userId={user?.id ?? null}
    />
  );
}
