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

import { SAMPLE_TEMPLATE_STATS } from './analytics-placeholders';
import { TemplateCards } from './templates/template-cards';
import { TemplateCardsSkeleton } from './templates/template-cards-skeleton';
import { TemplateStatsChips } from './templates/template-stats-chips';
import { useProposalTemplates } from './templates/use-proposal-templates';

export interface ProposalTemplatesShortcutProps {
  /** Opens the New template flow, for the empty state's own button. */
  onNewTemplate: () => void;
}

/** Every proposal template, as cards. See {@link ProposalTemplatesShortcutProps}. */
export function ProposalTemplatesShortcut({ onNewTemplate }: ProposalTemplatesShortcutProps) {
  const query = useProposalTemplates();

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

  // Placeholder outcomes per card (sample data, no pill) until
  // `proposals.template_id` is written and real per-template figures
  // exist; see analytics-placeholders.ts. Cards past the sample set carry
  // no chips, the honest "nothing sent" shape.
  return (
    <TemplateCards
      templates={query.data}
      overlay={(_t, i) => (
        <TemplateStatsChips stats={SAMPLE_TEMPLATE_STATS[i] ?? { sent: 0, accepted: 0, revenue: 0 }} />
      )}
    />
  );
}
