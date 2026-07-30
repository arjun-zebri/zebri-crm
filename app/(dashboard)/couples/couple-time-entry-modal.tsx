/**
 * Add or edit one tracked session by hand.
 *
 * Date plus duration, not start and end times. Someone writing up a
 * venue walkthrough that evening knows it took about an hour and a
 * half; making them reconstruct "2:10 to 3:40" is arithmetic in
 * service of two numbers the timesheet never shows.
 *
 * The stored row still has both instants, because the live timer
 * produces them and the totals are computed from them. This form
 * anchors them instead of asking:
 *
 * - Editing keeps the session where it already sat, moving only its
 *   end, so correcting a duration never silently reschedules the work.
 * - A new entry ends at the current time of day on the chosen date,
 *   which for "today" means it ends now. An entry that ends in the
 *   future would be a stranger reading than one that ends on the hour.
 *
 * @module app/(dashboard)/couples/couple-time-entry-modal
 */
'use client';

import { useState } from 'react';

import { TimeCategoryPicker } from '@/components/time-tracking/time-category-picker';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Modal } from '@/components/ui/modal';
import { entryDurationMs } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

import { CoupleTimeDurationField } from './couple-time-duration-field';

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

/** Whole minutes, rounded, for seeding the field from an existing row. */
function entryMinutes(entry: TimeEntry): number {
  return Math.max(1, Math.round(entryDurationMs(entry, Date.now()) / 60_000));
}

/**
 * Turn the form's date and duration back into the pair of instants the
 * row stores. See the module note for why the anchor differs between
 * adding and editing. Returns null when the date is unparseable.
 */
function toInstants(
  date: string,
  minutes: number,
  entry: TimeEntry | undefined,
): { startedAt: Date; endedAt: Date } | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;

  if (entry) {
    const original = new Date(entry.started_at);
    const startedAt = new Date(
      y,
      m - 1,
      d,
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      0,
    );
    return { startedAt, endedAt: new Date(startedAt.getTime() + minutes * 60_000) };
  }

  const now = new Date();
  const endedAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), 0, 0);
  return { startedAt: new Date(endedAt.getTime() - minutes * 60_000), endedAt };
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
  const [minutes, setMinutes] = useState<number | null>(
    entry ? entryMinutes(entry) : null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    entry?.category_id ?? null,
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const instants = minutes === null ? null : toInstants(date, minutes, entry);

  const handleSave = async () => {
    if (!instants) return;
    setError(null);
    const ok = await onSave({
      started_at: instants.startedAt.toISOString(),
      ended_at: instants.endedAt.toISOString(),
      category_id: categoryId,
      note: note.trim() || null,
    });
    if (ok) onClose();
    else setError('Could not save this entry. Check the duration and try again.');
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
            disabled={instants === null}
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
          {/* Matches the duration field's width: a full-width date field
              also stretches its calendar, since the day cells are square. */}
          <div className="w-56 max-w-full">
            <DatePicker
              value={date}
              onChange={setDate}
              size="sm"
              placeholder="Select date"
            />
          </div>
        </div>

        <CoupleTimeDurationField value={minutes} onChange={setMinutes} />

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
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Venue walkthrough, script draft, travel"
            className="w-full resize-none rounded-control border border-border bg-surface px-3 py-2 text-caption text-text outline-none transition placeholder:text-text-subtle focus:border-border-strong"
          />
        </div>

        {error ? <p className="text-caption text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
