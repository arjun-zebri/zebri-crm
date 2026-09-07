'use client';

/**
 * Add a to-do from the Upcoming view.
 *
 * An MC who thinks of something while reading their day should be able
 * to write it down there, for a couple or for themselves. Without this,
 * "renew my registration" has nowhere to live: it belongs to no couple,
 * and the personal list is otherwise reachable only by the converter.
 *
 * A modal rather than the inline row it replaces, so it matches the
 * couple profile's to-do composer and has room for a note.
 *
 * @module app/(dashboard)/workflows/queue-add-step
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';

import { addAdHocStepAction, addPersonalStepAction } from './instance-actions';

/** The sentinel for "not about a couple". Never a real couple id. */
const PERSONAL = 'personal';

export interface QueueAddStepProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful add, so the day reloads. */
  onAdded: () => void;
}

/**
 * The to-do composer for Upcoming. See {@link QueueAddStepProps}.
 *
 * The body mounts only while the modal is open, so every open starts on
 * empty fields without an effect clearing them behind the MC.
 */
export function QueueAddStep({ isOpen, onClose, onAdded }: QueueAddStepProps) {
  if (!isOpen) return null;
  return <QueueComposer onClose={onClose} onAdded={onAdded} />;
}

/** The open composer. */
function QueueComposer({ onClose, onAdded }: Omit<QueueAddStepProps, 'isOpen'>) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [target, setTarget] = useState(PERSONAL);

  const couples = useQuery({
    queryKey: ['queue-add-couples'],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('couples')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      // A date-only value becomes local midday rather than midnight, so a
      // timezone shift either way cannot move it onto another day.
      const dueAt = due ? new Date(`${due}T12:00:00`).toISOString() : null;
      const description = notes.trim();
      const res =
        target === PERSONAL
          ? await addPersonalStepAction({
              title: title.trim(),
              dueAt,
              ...(description ? { description } : {}),
            })
          : await addAdHocStepAction({
              coupleId: target,
              title: title.trim(),
              dueAt,
              ...(description ? { description } : {}),
            });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      onAdded();
      onClose();
    },
  });

  const canSave = title.trim().length > 0;

  const options = [
    { value: PERSONAL, label: 'Just for me' },
    ...(couples.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

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
          <Button
            loading={add.isPending}
            disabled={!canSave}
            onClick={() => add.mutate()}
          >
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
            if (e.key === 'Enter' && canSave) add.mutate();
          }}
        />
        <Select
          label="Who this is for"
          value={target}
          options={options}
          onValueChange={setTarget}
        />
        <Textarea
          label="Notes"
          placeholder="Anything you need to remember when you get to this"
          rows={3}
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
