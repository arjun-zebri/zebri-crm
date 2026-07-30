/**
 * Per-couple Time tab inside the Couple Profile.
 *
 * The MC's timesheet for this couple: total tracked, a per-category
 * breakdown, then every session newest-first. Sessions arrive either from
 * the header clock or from "Add time" for work that was never timed live.
 *
 * Composition only. Reads and writes live in `use-couple-time`, rows in
 * `couple-time-row`, and the add/edit form in `couple-time-entry-modal`.
 *
 * @module app/(dashboard)/couples/couple-time
 */
'use client';

import { Timer } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { formatDuration, sumByCategory, totalMs } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

import { CoupleTabEmpty, CoupleTabShell, type TabStat } from './couple-tab-shell';
import { CoupleTimeEntryModal } from './couple-time-entry-modal';
import { CoupleTimeRow } from './couple-time-row';
import { useCoupleTime } from './use-couple-time';

export interface CoupleTimeProps {
  coupleId: string;
}

export function CoupleTime({ coupleId }: CoupleTimeProps) {
  const { entries, isLoading, isError, saving, create, update, remove } =
    useCoupleTime(coupleId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);

  // Total first, then the biggest categories: the sub-line is meant to
  // answer "where did the hours go" at a glance.
  const stats: TabStat[] | undefined = entries.length
    ? [
        { label: `${formatDuration(totalMs(entries))} tracked` },
        ...sumByCategory(entries).map((c) => ({
          label: `${c.label} ${formatDuration(c.ms)}`,
        })),
      ]
    : undefined;

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };

  return (
    <CoupleTabShell
      title="Time"
      stats={stats}
      actions={
        <Button size="sm" onClick={openAdd}>
          Add time
        </Button>
      }
    >
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState
          title="Could not load tracked time."
          description="Refresh to try again."
        />
      ) : entries.length === 0 ? (
        <CoupleTabEmpty
          icon={Timer}
          title="No time tracked yet"
          description="Start the timer from the header, or add an entry manually."
        />
      ) : (
        <div>
          {entries.map((entry) => (
            <CoupleTimeRow
              key={entry.id}
              entry={entry}
              onEdit={() => openEdit(entry)}
              onDelete={() => setDeleting(entry)}
            />
          ))}
        </div>
      )}

      {formOpen ? (
        <CoupleTimeEntryModal
          isOpen
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          coupleId={coupleId}
          entry={editing ?? undefined}
          saving={saving}
          onSave={(input) =>
            editing
              ? update({ id: editing.id, patch: input })
              : create({ couple_id: coupleId, ...input })
          }
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete entry"
        description="This tracked time will be removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </CoupleTabShell>
  );
}
