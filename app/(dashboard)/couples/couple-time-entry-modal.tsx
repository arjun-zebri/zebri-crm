/**
 * Add or edit one tracked session by hand.
 *
 * Date plus start and end times, with the duration derived and shown
 * live: an MC filling this in is thinking "I worked 2 to 3", not "I
 * worked 60 minutes". Times are read in the viewer's timezone, which is
 * the local reading they intend.
 *
 * @module app/(dashboard)/couples/couple-time-entry-modal
 */
'use client';

import { useState } from 'react';

import { TimeCategoryPicker } from '@/components/time-tracking/time-category-picker';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatDuration } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

export interface CoupleTimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupleId: string;
  /** Present when editing an existing session. */
  entry?: TimeEntry | undefined;
  /** Persist. Resolves false when the save failed, keeping the modal open. */
  onSave: (input: {
    started_at: string;
    ended_at: string;
    category_id: string | null;
    note: string | null;
  }) => Promise<boolean>;
  saving: boolean;
}

/** `YYYY-MM-DD` in local time, which is what `DatePicker` expects. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** `HH:MM` in local time, which is what `<input type="time">` expects. */
function localTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export function CoupleTimeEntryModal({
  isOpen,
  onClose,
  entry,
  onSave,
  saving,
}: CoupleTimeEntryModalProps) {
  const [date, setDate] = useState(
    entry ? localDate(entry.started_at) : localDate(new Date().toISOString()),
  );
  const [start, setStart] = useState(entry ? localTime(entry.started_at) : '');
  const [end, setEnd] = useState(
    entry?.ended_at ? localTime(entry.ended_at) : '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    entry?.category_id ?? null,
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const startedAt = date && start ? new Date(`${date}T${start}`) : null;
  const endedAt = date && end ? new Date(`${date}T${end}`) : null;
  const valid =
    startedAt !== null &&
    endedAt !== null &&
    !Number.isNaN(startedAt.getTime()) &&
    !Number.isNaN(endedAt.getTime()) &&
    endedAt > startedAt;

  const handleSave = async () => {
    if (!valid || !startedAt || !endedAt) return;
    setError(null);
    const ok = await onSave({
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      category_id: categoryId,
      note: note.trim() || null,
    });
    if (ok) onClose();
    else setError('Could not save this entry. Check the times and try again.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      nested
      title={entry ? 'Edit time' : 'Add time'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1 block text-caption text-text-muted">Date</span>
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start"
            size="sm"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label="End"
            size="sm"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <p className="text-caption text-text-muted">
          {valid && startedAt && endedAt
            ? `Duration ${formatDuration(endedAt.getTime() - startedAt.getTime())}`
            : 'End must be after start.'}
        </p>

        <div>
          <span className="mb-1 block text-caption text-text-muted">
            Category
          </span>
          <TimeCategoryPicker value={categoryId} onChange={setCategoryId} />
        </div>

        <div>
          <label
            htmlFor="time-entry-note"
            className="mb-1 block text-caption text-text-muted"
          >
            Note
          </label>
          <textarea
            id="time-entry-note"
            rows={7}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Venue walkthrough, script draft, travel"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-caption text-text outline-none transition placeholder:text-text-subtle focus:border-border-strong"
          />
        </div>

        {error ? <p className="text-caption text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
