/**
 * The account's proposal templates, inline on `/proposals` — replaces the
 * old full `/proposals/templates` tab (which duplicated the sidebar's
 * Templates hub). No cap and no "See all": every template lives here, one
 * click from "New" -> "New template" away. The cards and their menu are
 * the shared `TemplateCards`, so this offers exactly what the hub does.
 *
 * @module app/(dashboard)/proposals/proposal-templates-shortcut
 */
'use client';

import { FileText, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import type { TemplateStats } from '@/features/proposals';

import { TemplateCards } from './templates/template-cards';
import { TemplateCardsSkeleton } from './templates/template-cards-skeleton';
import { TemplateStatsChips } from './templates/template-stats-chips';
import { useProposalTemplates } from './templates/use-proposal-templates';
import { useTemplatePerformance } from './use-proposal-analytics';

/** The honest "nothing sent" shape: the chips render nothing for it. */
const EMPTY_STATS: TemplateStats = { sent: 0, accepted: 0, revenue: 0, medianOpenSeconds: null };

export interface ProposalTemplatesShortcutProps {
  /** Opens the New template flow, for the empty state's own button. */
  onNewTemplate: () => void;
}

/** Every proposal template, as cards. See {@link ProposalTemplatesShortcutProps}. */
export function ProposalTemplatesShortcut({ onNewTemplate }: ProposalTemplatesShortcutProps) {
  const query = useProposalTemplates();
  // A failed figures query must not fail the card grid: fall back to empty
  // stats and the chips simply do not render.
  const perf = useTemplatePerformance();

  if (query.isLoading) return <TemplateCardsSkeleton />;
  if (query.error) {
    return <ErrorState title="Could not load templates" error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.data?.length) {
    // This is the page's one empty state: a proposal starts from a
    // template, so "no templates" is the thing to fix first. The
    // proposals list below stays silent while this shows.
    return (
      <Empty
        icon={FileText}
        title="No templates yet"
        description="Every proposal starts from a template. Create one to send your first proposal."
        action={
          <Button onClick={onNewTemplate} className="gap-1.5">
            <Plus size={16} strokeWidth={1.5} />
            New template
          </Button>
        }
      />
    );
  }

  return (
    <TemplateCards
      templates={query.data}
      overlay={(t) => <TemplateStatsChips stats={perf.data?.[t.id] ?? EMPTY_STATS} />}
    />
  );
}
