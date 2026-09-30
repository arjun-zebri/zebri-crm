'use client';

/**
 * The drafts an MC still has open, under the stats on `/proposals`.
 *
 * The per-proposal list was removed from this page on purpose (2026-09-19:
 * it read as a second, half-empty page under the templates grid), and
 * nothing replaced it, so a draft the MC had genuinely started was counted
 * in the stats above and reachable from nowhere. This is the smallest
 * thing that fixes that: the few most recently edited drafts, each with a
 * way in and a way out, and nothing at all on an account that has none.
 *
 * Deliberately not the old list: no columns, no status pills, no
 * pagination, and it never shows a proposal that has been sent - those
 * live on the couple's profile and at `/proposals/[id]`.
 *
 * @module app/(dashboard)/proposals/proposal-drafts-strip
 */
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import { formatRelativeTime } from '@/lib/utils';

import { deleteProposalAction } from './actions';
import type { ProposalListRow } from './use-proposals';

/** How many drafts the strip names before it falls back to counting the rest. */
const SHOWN = 3;

/** Props for {@link ProposalDraftsStrip}. */
export interface ProposalDraftsStripProps {
  /** Every proposal the account owns; the strip picks the drafts out itself. */
  rows: ProposalListRow[];
  /** True while the list is still loading: the strip stays out of the way rather than flashing in. */
  loading: boolean;
  /** Set when the list failed to load. */
  error: Error | null;
  /** Re-runs the list query, for the error state's own retry. */
  onRetry: () => void;
  /** Refreshes the list after a delete. */
  onDeleted: () => void;
}

/** See {@link ProposalDraftsStripProps}. */
export function ProposalDraftsStrip({ rows, loading, error, onRetry, onDeleted }: ProposalDraftsStripProps) {
  const router = useRouter();
  const { toast } = useToast();
  // One clock for the whole strip, read once on mount: "Edited 2h ago"
  // must not be recomputed on every render (it is also the only impure
  // call this component would otherwise make during render).
  const [nowMs] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<ProposalListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Freshest first: a draft is something being worked on, so the one
  // touched last is the one most likely being looked for.
  const drafts = useMemo(
    () => rows.filter((r) => r.status === 'draft').sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [rows],
  );

  // Compact rather than the primitive's full-page proportions: this sits
  // under the stats, not in place of a page.
  if (error) return <ErrorState title="Could not load your drafts" onRetry={onRetry} className="py-6" />;
  // Nothing at all on an empty (or still loading) account: this is a note
  // about work in progress, and there is none to speak of.
  if (loading || drafts.length === 0) return null;

  const remove = async () => {
    if (!confirming) return;
    setDeleting(true);
    const result = await deleteProposalAction(confirming.id);
    setDeleting(false);
    setConfirming(null);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast('Draft deleted', 'success');
    onDeleted();
  };

  return (
    <section aria-label="Drafts in progress" className="rounded-control border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-body text-text-muted">
        {drafts.length === 1 ? '1 draft in progress' : `${drafts.length} drafts in progress`}
      </h2>
      <ul className="divide-y divide-border">
        {drafts.slice(0, SHOWN).map((draft) => (
          <li key={draft.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-body text-text">{draft.couple?.name ?? draft.title}</span>
            <span className="text-body text-text-subtle">Edited {formatRelativeTime(draft.updated_at, nowMs)}</span>
            <div className="flex items-center gap-1">
              <Button variant="secondary" onClick={() => router.push(`/proposals/${draft.id}/design`)}>
                Open
              </Button>
              <Button
                variant="ghost"
                iconOnly
                aria-label={`Delete draft for ${draft.couple?.name ?? draft.title}`}
                onClick={() => setConfirming(draft)}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {drafts.length > SHOWN ? (
        <p className="border-t border-border px-4 py-3 text-body text-text-subtle">
          {drafts.length - SHOWN} more {drafts.length - SHOWN === 1 ? 'draft' : 'drafts'} on the couples they belong to.
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        title="Delete this draft?"
        description="The proposal and everything in it goes. The template it came from is not affected."
        confirmLabel="Delete draft"
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
        loading={deleting}
      />
    </section>
  );
}
