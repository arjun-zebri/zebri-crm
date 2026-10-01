'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { templateStats } from '../insights';
import { ProposalPreview, sampleOf } from '../proposal-preview';
import type { Proposal } from '../proposals-data';
import { PACKAGES, templateOf, type TemplateId } from '../templates-data';

/**
 * A template opened from the Templates tab: an `lg` dialog with the
 * template's name, what it offers and how it has done in the header,
 * then the whole page as a couple would see it, on the soft grey desk
 * the proposal modal uses. Use for a couple (the one primary) starts a
 * new proposal from it; Edit opens the builder stub.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/template-dialog
 */

export interface TemplateDialogProps {
  /** The open template; closed while null. */
  id: TemplateId | null;
  proposals: Proposal[];
  onUse: (id: TemplateId) => void;
  onEdit: (id: TemplateId) => void;
  onClose: () => void;
}

/** The template dialog. See {@link TemplateDialogProps}. */
export function TemplateDialog({ id, proposals, onUse, onEdit, onClose }: TemplateDialogProps) {
  const t = id ? templateOf(id) : null;
  const s = id ? templateStats(proposals, id) : null;
  return (
    <Dialog open={t !== null} onClose={onClose} size="lg" aria-labelledby="template-title">
      {t && s ? (
        <>
          <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="template-title" className="type-title text-zebra-950">
                {t.name}
              </h2>
              <p className="type-body text-zebra-500">
                {t.packages.map((p) => PACKAGES[p].name).join(', ')}
                {s.sent ? ` · sent ${s.sent} times` : ''}
                {s.rate !== null ? ` · ${s.rate}% accepted` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
              <Button variant="secondary" onClick={() => onEdit(t.id)}>
                Edit
              </Button>
              <Button onClick={() => onUse(t.id)}>Use for a couple</Button>
            </div>
            <div className="sm:border-l sm:border-zebra-950/5 sm:pl-4">
              <Button variant="ghost" square aria-label="Close" onClick={onClose}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 p-5 md:p-8">
            <ProposalPreview template={t} wedding={sampleOf(t)} className="mx-auto max-w-xl" />
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
