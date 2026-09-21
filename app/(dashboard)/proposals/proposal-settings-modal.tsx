/**
 * The proposal settings modal. Two scopes, one form:
 *
 * - `account`: the gear in {@link ProposalsHeader}; edits the account
 *   defaults in `proposal_settings`.
 * - `template`: "Settings" in a template card's menu; edits that
 *   template's own snapshot. The draft seeds from the template's snapshot
 *   when it has one, else from the account defaults, so a template starts
 *   out as "the account settings" and only diverges once saved. "Reset to
 *   account defaults" clears the snapshot again.
 *
 * Persist-only for now, in both scopes; see `settings.ts`'s module doc
 * for what does not yet read these values.
 *
 * @module app/(dashboard)/proposals/proposal-settings-modal
 */
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { resolveTemplateSettings, type TemplateListItem } from '@/features/proposals';

import { ProposalSettingsForm } from './proposal-settings-form';
import { fromDraft, toDraft, type ProposalSettingsDraft } from './proposal-settings-model';
import { useProposalSettings, useTemplateSettingsSave } from './use-proposal-settings';

/** Which row the modal edits. See the module doc. */
export type ProposalSettingsScope =
  | { kind: 'account' }
  | { kind: 'template'; template: Pick<TemplateListItem, 'id' | 'name' | 'settings'> };

export interface ProposalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ProposalSettingsScope;
}

/** See {@link ProposalSettingsModalProps}. */
export function ProposalSettingsModal({ isOpen, onClose, scope }: ProposalSettingsModalProps) {
  // The account row is fetched in both scopes: it is what a template
  // without its own snapshot seeds from.
  const { query, save } = useProposalSettings(onClose);
  const templateSave = useTemplateSettingsSave(onClose);
  const [seeded, setSeeded] = useState(false);
  const [draft, setDraft] = useState<ProposalSettingsDraft | null>(null);

  // Render-phase sync (same pattern as template-card.tsx's `syncedName`),
  // not an effect: seeds the draft once, the first time the fetched row is
  // available while open, and resets on close so the next open re-seeds
  // from the latest data rather than showing a stale edit.
  if (!isOpen && seeded) {
    setSeeded(false);
    setDraft(null);
  } else if (isOpen && !seeded && query.data) {
    setSeeded(true);
    setDraft(toDraft(scope.kind === 'template' ? resolveTemplateSettings(query.data, scope.template.settings) : query.data));
  }

  const template = scope.kind === 'template' ? scope.template : null;
  const saving = save.isPending || templateSave.isPending;
  const submit = () => {
    if (!draft) return;
    if (template) templateSave.mutate({ id: template.id, settings: fromDraft(draft) });
    else save.mutate(fromDraft(draft));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={template ? `${template.name} settings` : 'Proposal settings'}
      footer={
        draft ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              {template?.settings ? (
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => templateSave.mutate({ id: template.id, settings: null })}
                >
                  Reset to account defaults
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={saving} onClick={submit}>
                Save
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {query.isLoading ? (
        <Loading label="Loading settings" />
      ) : query.error ? (
        <ErrorState title="Could not load proposal settings" error={query.error} onRetry={() => void query.refetch()} />
      ) : draft ? (
        <ProposalSettingsForm draft={draft} onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))} />
      ) : null}
    </Modal>
  );
}
