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
import { formatDuration, totalMs } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

import { CoupleTabEmpty, CoupleTabShell, type TabStat } from './couple-tab-shell';
import { CoupleTimeBreakdown } from './couple-time-breakdown';
import { CoupleTimeEntryModal } from './couple-time-entry-modal';
import { CoupleTimeRow } from './couple-time-row';
import { CoupleTimeSkeleton } from './couple-time-skeleton';
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

  // Just the total here. The per-category split moved into the
  // breakdown bar below, which shows proportion as well as magnitude;
  // repeating it as chips would say the same thing twice.
  const stats: TabStat[] | undefined = entries.length
    ? [{ label: `${formatDuration(totalMs(entries))} tracked` }]
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
        <CoupleTimeSkeleton />
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
          <CoupleTimeBreakdown entries={entries} />
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
