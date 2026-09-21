'use client';

/**
 * Step 2 of the New template flow, reached from "Use a template": a
 * category-filterable grid of {@link TEMPLATE_STARTERS}, each shown as a
 * real thumbnail of the layout it builds. Picking a card selects it (does
 * not confirm); "Use this template" in the footer advances the flow to
 * naming.
 *
 * @module app/(dashboard)/proposals/templates/starter-gallery-modal
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  LayoutThumbnail, STARTER_CATEGORIES, TEMPLATE_STARTERS, type StarterCategory, type TemplateStarter,
} from '@/features/proposals';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';

/** Props for {@link StarterGalleryModal}. */
export interface StarterGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Gallery's Back button: returns to the "Start from scratch / Use a template" choice. */
  onBack: () => void;
  selected: TemplateStarter | null;
  onSelect: (starter: TemplateStarter) => void;
  /** "Use this template": commits `selected` and moves to naming. No-op while `selected` is null (the button is disabled). */
  onConfirm: () => void;
}

/** One starter card: thumbnail, name, description. Selecting it rings the card, it does not close the modal. */
function StarterCard({ starter, branding, brandingLoading, isSelected, onSelect }: {
  starter: TemplateStarter; branding: ReturnType<typeof useCurrentBranding>['branding']; brandingLoading: boolean;
  isSelected: boolean; onSelect: () => void;
}) {
  // Not a `<button>`: the thumbnail is a real (inert) render of the layout,
  // and its accept section contains a `<button>`, which HTML forbids inside
  // another button (React logs a hydration error). A `role="option"` div
  // with the same keyboard handling keeps the card selectable.
  return (
    <div
      role="option"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-selected={isSelected}
      className={`flex cursor-pointer flex-col gap-2 rounded-control border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg ${
        isSelected ? 'border-border ring-2 ring-brand-fg' : 'border-border hover:bg-surface-muted'
      }`}
    >
      {brandingLoading || !branding ? (
        <div className="aspect-[4/3] animate-pulse rounded-control bg-surface-muted" />
      ) : (
        <LayoutThumbnail layout={starter.build()} branding={branding} />
      )}
      <span className="text-body font-medium text-text">{starter.name}</span>
      <span className="text-body text-text-muted">{starter.description}</span>
    </div>
  );
}

/** The starter gallery. See {@link StarterGalleryModalProps}. */
export function StarterGalleryModal({ isOpen, onClose, onBack, selected, onSelect, onConfirm }: StarterGalleryModalProps) {
  const [category, setCategory] = useState<StarterCategory['id']>('all');
  const { branding, loading: brandingLoading } = useCurrentBranding('proposal');
  const starters = category === 'all' ? TEMPLATE_STARTERS : TEMPLATE_STARTERS.filter((s) => s.category === category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose a template"
      size="2xl"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={onConfirm} disabled={!selected}>Use this template</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {STARTER_CATEGORIES.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setCategory(chip.id)}
              aria-pressed={category === chip.id}
              className={`rounded-pill px-3 py-1 text-body transition ${
                category === chip.id ? 'bg-brand-fg text-text-inverse' : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div role="listbox" aria-label="Starters" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {starters.map((starter) => (
            <StarterCard
              key={starter.id}
              starter={starter}
              branding={branding}
              brandingLoading={brandingLoading}
              isSelected={selected?.id === starter.id}
              onSelect={() => onSelect(starter)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
