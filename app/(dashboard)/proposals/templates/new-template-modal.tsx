'use client';

/**
 * Step 1 of the New template flow (founder's ask): "when you click new
 * template you should have start from scratch or use a template as a
 * modal." Two large choice cards; picking either advances
 * `useNewTemplateFlow`'s step, it never creates anything itself.
 *
 * @module app/(dashboard)/proposals/templates/new-template-modal
 */
import { FileText, LayoutGrid } from 'lucide-react';

import { Modal } from '@/components/ui/modal';

/** Props for {@link NewTemplateModal}. */
export interface NewTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "Start from scratch" chosen. */
  onScratch: () => void;
  /** "Use a template" chosen: opens the starter gallery. */
  onGallery: () => void;
}

/** One large choice card. A real `<button>`, so no `cursor-pointer` class is needed. */
function ChoiceCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-start gap-2 rounded-control border border-border p-4 text-left transition hover:bg-surface-muted"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-surface-emphasis text-text">{icon}</span>
      <span className="text-section font-semibold text-text">{title}</span>
      <span className="text-body text-text-muted">{description}</span>
    </button>
  );
}

/** New template: "Start from scratch" or "Use a template". See {@link NewTemplateModalProps}. */
export function NewTemplateModal({ isOpen, onClose, onScratch, onGallery }: NewTemplateModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New template" size="md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <ChoiceCard
          icon={<FileText size={18} strokeWidth={1.5} aria-hidden="true" />}
          title="Start from scratch"
          description="A blank page with one text section."
          onClick={onScratch}
        />
        <ChoiceCard
          icon={<LayoutGrid size={18} strokeWidth={1.5} aria-hidden="true" />}
          title="Use a starter design"
          description="Start from a ready-made layout and make it yours."
          onClick={onGallery}
        />
      </div>
    </Modal>
  );
}
