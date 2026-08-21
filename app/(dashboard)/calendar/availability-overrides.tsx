'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Database } from '@/types/database';

import { formatOverrideDate, formatTimeLabel } from './availability-utils';

type AvailabilityOverride = Database['public']['Tables']['availability_overrides']['Row'];

/**
 * Props for the date-overrides card.
 */
export interface AvailabilityOverridesProps {
  overrides: AvailabilityOverride[];
  onDeleteOverride: (date: string) => Promise<void>;
}

/**
 * Per-date exceptions to the weekly schedule: a full-day block
 * (`available: false`) or a one-off window that replaces the weekly one.
 *
 * Unlike the weekly editor, these save as soon as they are added or
 * deleted, so there is no Save bar here. Adding one happens in
 * {@link AvailabilityOverrideModal}, opened from the action bar.
 */
export function AvailabilityOverrides({
  overrides,
  onDeleteOverride,
}: AvailabilityOverridesProps) {
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = async () => {
    if (!confirmDeleteDate) return;
    setDeleting(true);
    try {
      await onDeleteOverride(confirmDeleteDate);
    } finally {
      setDeleting(false);
      setConfirmDeleteDate(null);
    }
  };

  const describeOverride = (override: AvailabilityOverride): string => {
    if (!override.available) return 'Blocked';
    if (!override.start_time || !override.end_time) return 'Custom hours';
    return `${formatTimeLabel(override.start_time)} to ${formatTimeLabel(override.end_time)}`;
  };

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-section font-semibold">Date overrides</h3>
        <span className="text-body text-text-muted">
          These beat the weekly hours for that date
        </span>
      </div>

      {overrides.length === 0 ? (
        <p className="px-4 py-3 text-body text-text-muted">
          No overrides yet. Add one to block a wedding day or open hours you
          would not normally work.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {overrides.map((override) => (
            <div
              key={override.date}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-body text-text">
                {formatOverrideDate(override.date)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-body text-text-muted">
                  {describeOverride(override)}
                </span>
                <Button
                  iconOnly
                  variant="ghost"
                  onClick={() => setConfirmDeleteDate(override.date)}
                  aria-label={`Delete override for ${formatOverrideDate(override.date)}`}
                >
                  <X strokeWidth={1.5} className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteDate !== null}
        title="Delete this override?"
        description="This will restore the weekly hours for that date."
        onConfirm={handleDeleteClick}
        onCancel={() => setConfirmDeleteDate(null)}
        loading={deleting}
      />
    </Card>
  );
}
