/**
 * Timesheet prompt shown the moment a timer stops.
 *
 * The session is already saved by the time this opens: the dialog only
 * annotates it. Skip is therefore a real option rather than a way to
 * lose tracked time, which is why nothing here is required.
 *
 * The form is keyed by entry id so a second stop mounts a fresh one and
 * cannot inherit the previous session's note or category. That is the
 * reason for the outer/inner split rather than resetting state in an
 * effect.
 *
 * @module components/time-tracking/stop-note-dialog
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { updateCoupleTimeEntryAction } from '@/app/(dashboard)/couples/time-actions';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { entryDurationMs, formatDuration } from '@/lib/time-tracking/format';
import type { StoppedSession } from '@/types/time-tracking';

import { TimeCategoryPicker } from './time-category-picker';
import { COUPLE_TIME_ENTRIES_KEY } from './use-time-categories';

export interface StopNoteDialogProps {
  /** The session just stopped, or null when nothing needs annotating. */
  pending: StoppedSession | null;
  onClose: () => void;
}

export function StopNoteDialog({ pending, onClose }: StopNoteDialogProps) {
  if (!pending) return null;
  return (
    <StopNoteForm key={pending.entry.id} pending={pending} onClose={onClose} />
  );
}

function StopNoteForm({
  pending,
  onClose,
}: {
  pending: StoppedSession;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const result = await updateCoupleTimeEntryAction({
        id: pending.entry.id,
        patch: { note: note.trim() || null, category_id: categoryId },
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [COUPLE_TIME_ENTRIES_KEY, pending.entry.couple_id],
      });
      toast('Time saved');
      onClose();
    },
    onError: () => toast('Could not save the note', 'error'),
  });

  // A stopped session always has an end, so it measures itself. Reading
  // the wall clock during render would be impure for no benefit.
  const duration = formatDuration(
    entryDurationMs(
      pending.entry,
      Date.parse(pending.entry.ended_at ?? pending.entry.started_at),
    ),
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      nested
      title={
        <span className="text-body">
          Stopped &middot; {duration} &middot; {pending.couple_name}
        </span>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Category first: it is the one-tap decision, and the note is the
            long-form field the eye should land on last. */}
        <div>
          <span className="mb-1 block text-body text-text-muted">
            Category
          </span>
          <TimeCategoryPicker value={categoryId} onChange={setCategoryId} />
        </div>
        <div>
          <label
            htmlFor="stop-note"
            className="mb-1 block text-body text-text-muted"
          >
            What did you work on?
          </label>
          <textarea
            id="stop-note"
            autoFocus
            rows={10}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Venue walkthrough, script draft, travel"
            className="w-full resize-none rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none transition placeholder:text-text-subtle focus:border-border-strong"
          />
        </div>
      </div>
    </Modal>
  );
}
