'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { TemplatesIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../../account';
import { TemplatePage } from '../../doc-builder/doc-types/proposal/template-page';
import { choiceOf } from '../../doc-builder/doc-types/proposal/template-store';
import { templateStats } from '../insights';
import { sampleOf } from '../proposal-preview';
import type { Proposal } from '../proposals-data';
import { packagesOf } from '../templates-data';

/**
 * A template opened from the Templates tab: an `lg` dialog on the v2
 * anatomy (`DialogHeader`, then the template's name large, what it
 * offers and how it has done; its actions on the header row before Close),
 * then the whole page as a couple would see it (the template as the MC
 * last edited it), on the soft grey desk the proposal modal uses. Use
 * for a couple (the one primary) starts a new proposal from it; Edit
 * opens it in the editor.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/template-dialog
 */

export interface TemplateDialogProps {
  /** The open template's key; closed while null. */
  id: string | null;
  proposals: Proposal[];
  onUse: (key: string) => void;
  onEdit: (key: string) => void;
  onClose: () => void;
}

/** The template dialog. See {@link TemplateDialogProps}. */
export function TemplateDialog({ id, proposals, onUse, onEdit, onClose }: TemplateDialogProps) {
  const account = useAccount();
  const choice = id ? choiceOf(id) : null;
  const t = choice?.template ?? null;
  const s = choice ? (choice.custom ? { sent: 0, rate: null } : templateStats(proposals, choice.template.id)) : null;
  const offer = t ? (account.packages?.length ? account.packages : packagesOf(t)) : [];
  return (
    <Dialog open={t !== null} onClose={onClose} size="lg" aria-labelledby="template-title template-name">
      {choice && t && s ? (
        <>
          <DialogHeader
            id="template-title"
            icon={TemplatesIcon}
            title="Template"
            actions={
              <>
                <Button variant="secondary" onClick={() => onEdit(choice.key)}>
                  Edit
                </Button>
                <Button onClick={() => onUse(choice.key)}>Use for a couple</Button>
              </>
            }
          />
          <div className="shrink-0 space-y-1 px-6 pb-6 pt-2 sm:px-10">
            <p id="template-name" className="type-title text-zebra-950">
              {t.name}
            </p>
            <p className="type-body text-zebra-500">
              {offer.map((p) => p.name).join(', ')}
              {s.sent ? ` · sent ${s.sent} times` : ''}
              {s.rate !== null ? ` · ${s.rate}% accepted` : ''}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 p-5 md:p-8">
            <TemplatePage template={choice.key} wedding={sampleOf(t)} className="mx-auto max-w-3xl" />
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
