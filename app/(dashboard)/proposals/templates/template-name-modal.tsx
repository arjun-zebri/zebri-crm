'use client';

/**
 * Final step of the New template flow: name it, then create. Prefilled
 * with the chosen starter's name ("Untitled template" for a blank one).
 * Submitting fires `onSubmit`; the caller owns the actual
 * `createTemplateAction` call and the redirect to the editor.
 *
 * @module app/(dashboard)/proposals/templates/template-name-modal
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

/** Props for {@link TemplateNameModal}. */
export interface TemplateNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prefilled value: the starter's name, or "Untitled template" for a blank page. */
  defaultName: string;
  /** True while the create mutation is in flight. */
  loading: boolean;
  onSubmit: (name: string) => void;
}

/** Name-and-create step. See {@link TemplateNameModalProps}. */
export function TemplateNameModal({ isOpen, onClose, defaultName, loading, onSubmit }: TemplateNameModalProps) {
  const [name, setName] = useState(defaultName);
  // Re-seeds the field from `defaultName` on every closed -> open
  // transition (the render-phase "adjust state on prop change" pattern
  // `template-card.tsx`'s rename field uses). Keyed on the transition,
  // not on `defaultName` changing: picking the same starter twice in a
  // row kept the text typed into the cancelled first attempt (review
  // finding). A re-render while it stays open never resets it.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setName(defaultName);
  }

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Name your template" size="sm">
      <div className="flex flex-col gap-3">
        <Input
          label="Template name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            submit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={loading} disabled={!name.trim()}>Create</Button>
        </div>
      </div>
    </Modal>
  );
}
