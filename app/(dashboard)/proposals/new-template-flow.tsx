/**
 * The "New template" flow, triggered from the header's New menu: the same
 * Start from scratch / Use a starter -> name it -> create sequence
 * `TemplatesGrid` offers, factored out so `/proposals` can open it without
 * mounting the full grid. `isOpen`/`onOpenChange` are the only state the
 * caller owns; the flow's own step machine (`useNewTemplateFlow`) is
 * internal.
 *
 * @module app/(dashboard)/proposals/new-template-flow
 */
'use client';

import { useState } from 'react';

import { blankTemplateLayout } from '@/features/proposals';

import { NewTemplateModal } from './templates/new-template-modal';
import { StarterGalleryModal } from './templates/starter-gallery-modal';
import { TemplateNameModal } from './templates/template-name-modal';
import { useNewTemplateFlow } from './templates/use-new-template-flow';
import { useTemplateMutations } from './templates/use-template-mutations';

export interface NewTemplateFlowProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** See {@link NewTemplateFlowProps}. */
export function NewTemplateFlow({ isOpen, onOpenChange }: NewTemplateFlowProps) {
  const flow = useNewTemplateFlow();
  const [opened, setOpened] = useState(false);

  // Render-phase sync (same pattern as proposal-settings-modal.tsx): the
  // caller only knows "open or not"; this starts/resets the flow's own
  // step machine to match.
  if (isOpen && !opened) {
    setOpened(true);
    flow.open();
  } else if (!isOpen && opened) {
    setOpened(false);
    flow.close();
  }

  const { create } = useTemplateMutations(
    () => onOpenChange(false),
    () => {},
  );

  const handleClose = () => {
    flow.close();
    onOpenChange(false);
  };

  return (
    <>
      <NewTemplateModal
        isOpen={flow.step === 'choose'}
        onClose={handleClose}
        onScratch={flow.chooseScratch}
        onGallery={flow.chooseGallery}
      />
      <StarterGalleryModal
        isOpen={flow.step === 'gallery'}
        onClose={handleClose}
        onBack={flow.backToChoose}
        selected={flow.starter}
        onSelect={flow.selectStarter}
        onConfirm={flow.confirmStarter}
      />
      <TemplateNameModal
        isOpen={flow.step === 'name'}
        onClose={handleClose}
        defaultName={flow.starter?.name ?? 'Untitled template'}
        loading={create.isPending}
        onSubmit={(name) => create.mutate({ name, layout: flow.starter ? flow.starter.build() : blankTemplateLayout() })}
      />
    </>
  );
}
