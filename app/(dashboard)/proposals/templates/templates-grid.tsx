'use client';

/**
 * The proposal templates grid: the account's named templates with a real
 * thumbnail, rename / set default / duplicate / delete, and the three-step
 * "New template" flow (founder's ask, UX audit §3.8-3.9): New template ->
 * Start from scratch / Use a template -> (gallery ->) name it -> created
 * and opened in the editor. Ensures the default exists on first visit
 * (which is also the lazy v1 -> v2 migration).
 *
 * Header-less on purpose: it is mounted as the Proposals tab of the
 * /templates hub (`app/(dashboard)/templates/proposal-templates-tab.tsx`),
 * and `header` receives the "New template" opener so the host can place
 * the button where its own chrome expects it. `/proposals` shows the same
 * cards through `proposal-templates-shortcut.tsx`, which owns its own
 * New template flow via the page header.
 *
 * @module app/(dashboard)/proposals/templates/templates-grid
 */
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { blankTemplateLayout } from '@/features/proposals';

import { NewTemplateModal } from './new-template-modal';
import { StarterGalleryModal } from './starter-gallery-modal';
import { TemplateCards } from './template-cards';
import { TemplateCardsSkeleton } from './template-cards-skeleton';
import { TemplateNameModal } from './template-name-modal';
import { useNewTemplateFlow } from './use-new-template-flow';
import { useProposalTemplates } from './use-proposal-templates';
import { useTemplateMutations } from './use-template-mutations';

/** Props for {@link TemplatesGrid}. */
export interface TemplatesGridProps {
  /** Renders the host's chrome above the grid; `openNew` starts the New template flow. */
  header: (openNew: () => void) => ReactNode;
}

/** The proposal templates grid plus its New template flow. See the module doc. */
export function TemplatesGrid({ header }: TemplatesGridProps) {
  const flow = useNewTemplateFlow();
  const { create } = useTemplateMutations(
    () => flow.close(),
    () => {},
  );
  const query = useProposalTemplates();

  return (
    <div className="space-y-6">
      {header(flow.open)}
      {query.isLoading ? (
        <TemplateCardsSkeleton />
      ) : query.error ? (
        <ErrorState title="Could not load templates" error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <Empty icon={FileText} title="No templates yet" description="Your first template is created the moment you open this tab." />
      ) : (
        <TemplateCards templates={query.data} />
      )}
      <NewTemplateModal isOpen={flow.step === 'choose'} onClose={flow.close} onScratch={flow.chooseScratch} onGallery={flow.chooseGallery} />
      <StarterGalleryModal
        isOpen={flow.step === 'gallery'}
        onClose={flow.close}
        onBack={flow.backToChoose}
        selected={flow.starter}
        onSelect={flow.selectStarter}
        onConfirm={flow.confirmStarter}
      />
      <TemplateNameModal
        isOpen={flow.step === 'name'}
        onClose={flow.close}
        defaultName={flow.starter?.name ?? 'Untitled template'}
        loading={create.isPending}
        onSubmit={(name) => create.mutate({ name, layout: flow.starter ? flow.starter.build() : blankTemplateLayout() })}
      />
    </div>
  );
}
