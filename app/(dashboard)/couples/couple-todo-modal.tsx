'use client';

/**
 * "Add a to-do" for one couple.
 *
 * The inline row this replaces was the only create in the app that was
 * not a button and a modal, and it had no room for a note, so ad-hoc
 * work arrived as a bare line of text. Same shape as the builder's
 * manual step composer, minus the timing control: a loose to-do is due
 * on a date the MC picks, not relative to anything.
 *
 * @module app/(dashboard)/couples/couple-todo-modal
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';

export interface CoupleTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the to-do. Resolves once it has landed. */
  onAdd: (input: {
    title: string;
    description: string | null;
    dueAt: string | null;
  }) => Promise<void>;
}

/**
 * The to-do composer. See {@link CoupleTodoModalProps}.
 *
 * The body mounts only while the modal is open, so every open starts on
 * empty fields without an effect clearing them behind the MC.
 */
export function CoupleTodoModal({ isOpen, onClose, onAdd }: CoupleTodoModalProps) {
  if (!isOpen) return null;
  return <TodoComposer onClose={onClose} onAdd={onAdd} />;
}

/** The open composer. */
function TodoComposer({ onClose, onAdd }: Omit<CoupleTodoModalProps, 'isOpen'>) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  async function submit() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onAdd({
        title: title.trim(),
        description: notes.trim() ? notes.trim() : null,
        // A date-only value becomes local midday rather than midnight, so
        // a timezone shift either way cannot move it onto another day.
        dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add a to-do"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!canSave} onClick={() => void submit()}>
            Add
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="What needs doing"
          placeholder="e.g. Ring the venue to confirm access time"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <Textarea
          label="Notes"
          placeholder="Anything you need to remember when you get to this"
          // Tall enough to hold a real note without scrolling: the field
          // cannot be dragged bigger, so the height has to be right here.
          rows={7}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <div className="space-y-1">
          <span className="block text-body font-medium text-text">Due date</span>
          <DatePicker value={due} onChange={setDue} placeholder="Pick a date" />
        </div>
      </div>
    </Modal>
  );
}
