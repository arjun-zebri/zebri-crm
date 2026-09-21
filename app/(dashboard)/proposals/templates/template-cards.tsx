'use client';

/**
 * The grid of {@link TemplateCard}s plus everything a card's menu needs
 * behind it: the set default / duplicate / delete mutations, the
 * delete confirmation, and the per-template settings modal. Shared by the /templates hub's grid and the
 * cards on `/proposals` so both places offer the same menu; the list
 * itself (loading / error / empty) and the New template flow stay with
 * each host, which is why this takes `templates` rather than querying.
 *
 * @module app/(dashboard)/proposals/templates/template-cards
 */
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { ProposalSettingsModal } from '@/app/(dashboard)/proposals/proposal-settings-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { TemplateListItem } from '@/features/proposals';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';

import { TemplateCard } from './template-card';
import { useTemplateMutations } from './use-template-mutations';

/** Props for {@link TemplateCards}. */
export interface TemplateCardsProps {
  /** The templates to show, in list order. The host has already handled the empty case. */
  templates: TemplateListItem[];
  /** Optional per-card thumbnail overlay (see `TemplateCardProps.overlay`); `index` is the card's position in `templates`. */
  overlay?: (template: TemplateListItem, index: number) => ReactNode;
}

/** See {@link TemplateCardsProps}. */
export function TemplateCards({ templates, overlay }: TemplateCardsProps) {
  const router = useRouter();
  const { branding } = useCurrentBranding('proposal');
  const [pendingDelete, setPendingDelete] = useState<TemplateListItem | null>(null);
  // The id, not the item: the modal reads `settings` from the live list so
  // a save (which refetches) is reflected on the very next open.
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const settingsTemplate = templates.find((t) => t.id === settingsId) ?? null;
  const { setDefault, duplicate, remove } = useTemplateMutations(
    // `create` is the host's (its New template flow), never fired from a card.
    () => {},
    () => setPendingDelete(null),
  );

  return (
    <>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t, i) => (
          <TemplateCard
            key={t.id}
            template={t}
            branding={branding}
            canDelete={templates.length > 1}
            onEdit={() => router.push(`/proposals/templates/${t.id}`)}
            onSetDefault={() => setDefault.mutate(t.id)}
            onDuplicate={() => duplicate.mutate(t.id)}
            onSettings={() => setSettingsId(t.id)}
            onDelete={() => setPendingDelete(t)}
            overlay={overlay?.(t, i)}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        description="Proposals already created from it keep their own copy."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
      {settingsTemplate ? (
        <ProposalSettingsModal
          scope={{ kind: 'template', template: settingsTemplate }}
          isOpen
          onClose={() => setSettingsId(null)}
        />
      ) : null}
    </>
  );
}
