/**
 * Single meeting type presented as a card.
 *
 * Each meeting type is a shareable link, so the card leads with what the
 * couple would see (name, length, how you meet) and puts the link action in
 * the footer where it is the obvious next move.
 *
 * @module app/(dashboard)/calendar/meeting-type-card
 */
'use client';

import { MapPin, Pencil, Phone, Video } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu';
import { Toggle } from '@/components/ui/toggle';
import { buildScriptSnippet } from '@/lib/booking/snippets';
import type { Database } from '@/types/database';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

/** How each location type is drawn and described. */
const LOCATION: Record<string, { label: string; Icon: typeof Video }> = {
  video: { label: 'video', Icon: Video },
  phone: { label: 'phone', Icon: Phone },
  in_person: { label: 'in person', Icon: MapPin },
};

export interface MeetingTypeCardProps {
  meetingType: MeetingType;
  /**
   * Bookings taken against this type in the current calendar month. Shown as
   * a plain count so the MC can see at a glance which links are earning their
   * keep and which are dormant.
   */
  bookedThisMonth: number;
  onEdit?: (meetingType: MeetingType) => void;
  onDelete?: (id: string) => void;
  /**
   * Flip whether this type accepts bookings. Lives on the card rather than
   * behind the edit modal because pausing a link is the one change an MC makes
   * in a hurry, and it should not cost them a modal and a save.
   */
  onToggleActive?: (meetingType: MeetingType, active: boolean) => void;
}

/**
 * Card for one meeting type: status, name, duration and location, description,
 * this month's booking count, and the link/edit/more actions.
 */
export function MeetingTypeCard({
  meetingType,
  bookedThisMonth,
  onEdit,
  onDelete,
  onToggleActive,
}: MeetingTypeCardProps) {
  const location = LOCATION[meetingType.location_type];
  const LocationIcon = location?.Icon ?? Video;

  const bookingUrl = useCallback(
    () =>
      `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${meetingType.share_token}`,
    [meetingType.share_token],
  );

  const embedCode = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return buildScriptSnippet(origin, meetingType.share_token);
  }, [meetingType.share_token]);

  const actions: RowAction[] = [
    {
      label: 'Open booking page',
      onSelect: () => window.open(bookingUrl(), '_blank', 'noopener,noreferrer'),
    },
    {
      label: 'Copy embed code',
      onSelect: async () => {
        try {
          await navigator.clipboard.writeText(embedCode);
        } catch {
          // Clipboard permission denied. Nothing useful to do here: the embed
          // code is also reachable from the edit modal.
        }
      },
    },
    {
      label: 'Delete',
      onSelect: () => onDelete?.(meetingType.id),
      destructive: true,
    },
  ];

  return (
    <Card padding="md" className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="w-8 h-8 rounded-control bg-surface-emphasis flex items-center justify-center shrink-0">
          <LocationIcon size={16} strokeWidth={1.5} className="text-text-muted" />
        </div>
        <Toggle
          checked={meetingType.active}
          onChange={(next) => onToggleActive?.(meetingType, next)}
          label={meetingType.active ? 'Active' : 'Paused'}
          ariaLabel={`${meetingType.active ? 'Pause' : 'Activate'} ${meetingType.name}`}
          className="shrink-0"
        />
      </div>

      <div className="flex-1 mt-4">
        <h3 className="text-section font-semibold text-text truncate" title={meetingType.name}>
          {meetingType.name}
        </h3>
        <div className="text-body text-text-muted mt-0.5">
          {meetingType.duration_minutes} min · {location?.label ?? meetingType.location_type}
          {/* Worth surfacing here: a type on its own hours does not follow the
              Availability tab, and that is invisible until you open the modal. */}
          {meetingType.uses_custom_availability ? ' · custom hours' : ''}
        </div>

        {meetingType.description && (
          <p className="text-body text-text-muted mt-2 line-clamp-3">
            {meetingType.description}
          </p>
        )}

        <div className="text-body text-text-subtle mt-3">
          {bookedThisMonth > 0
            ? `${bookedThisMonth} booked this month`
            : 'Not booked this month'}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
        <CopyButton
          value={bookingUrl}
          label="Copy link"
          copiedLabel="Copied"
          variant="outline"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            iconOnly
            onClick={() => onEdit?.(meetingType)}
            aria-label={`Edit ${meetingType.name}`}
            data-testid={`meeting-type-edit-${meetingType.id}`}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </Button>
          {/* alwaysVisible: the menu defaults to hover-only, which suits a
              dense table row but leaves a card looking like it has a stray
              pencil floating short of the edge, and hides the actions outright
              on touch. */}
          <RowActionsMenu actions={actions} size="sm" alwaysVisible />
        </div>
      </div>
    </Card>
  );
}
