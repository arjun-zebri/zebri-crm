/**
 * Meeting Types tab for the Calendar page.
 *
 * Presents each meeting type as a card in a responsive grid, with a starter
 * template row underneath. Includes loading, error, and empty states.
 *
 * @module app/(dashboard)/calendar/meeting-types-tab
 */
'use client';

import { useMemo, useState } from 'react';

import { CalendarConnectNote } from '@/components/calendar/calendar-connect-prompt';
import { useCalendarConnections } from '@/components/calendar/use-calendar-connections';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import type { Database } from '@/types/database';

import { MeetingTypesSkeleton } from './_components/tab-skeletons';
import { MeetingTypeCard } from './meeting-type-card';
import { MeetingTypeModal } from './meeting-type-modal';
import { meetingTypeRowToInput } from './meeting-type-schema';
import { MeetingTypeTemplatePicker } from './meeting-type-template-picker';
import { type MeetingTypeTemplate } from './meeting-type-templates';
import { useBookings } from './use-bookings';
import {
  useMeetingTypes,
  useDeleteMeetingType,
  useUpdateMeetingType,
} from './use-meeting-types';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

interface MeetingTypesTabProps {
  onNew?: () => void;
  onEdit?: (meetingType: MeetingType) => void;
}

/**
 * Meeting Types tab content. Lists all meeting types for the authenticated
 * user with actions to edit/delete and copy the public booking link.
 */
export function MeetingTypesTab({ onNew, onEdit }: MeetingTypesTabProps) {
  const { data, isLoading, error, refetch } = useMeetingTypes();
  const { data: bookings = [] } = useBookings();
  const { connections } = useCalendarConnections();
  const deleteType = useDeleteMeetingType();
  const updateType = useUpdateMeetingType();

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editingMeetingType, setEditingMeetingType] = useState<MeetingType | null>(null);
  const [seedTemplate, setSeedTemplate] = useState<MeetingTypeTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  /**
   * Bookings per meeting type in the current calendar month.
   *
   * Counted here rather than queried because the bookings list is already
   * loaded for the Bookings tab, so this costs nothing extra.
   */
  const bookedThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const counts: Record<string, number> = {};
    for (const booking of bookings) {
      if (booking.status === 'cancelled') continue;
      const typeId = booking.meeting_type?.id;
      if (!typeId) continue;
      const startedAt = new Date(booking.starts_at).getTime();
      if (startedAt < monthStart || startedAt >= monthEnd) continue;
      counts[typeId] = (counts[typeId] ?? 0) + 1;
    }
    return counts;
  }, [bookings]);

  /**
   * True when a video meeting type would produce a booking with no join link.
   *
   * The Meet/Teams URL is minted by the calendar event push, so with no
   * connection `video_join_url` stays null and the couple receives a "Video
   * call" confirmation with nothing to click. That is the one gap here the
   * couple sees, not just the MC, so it is worth calling out on this tab.
   */
  const videoTypesWithoutCalendar = useMemo(
    () =>
      connections.length === 0 &&
      data.some((type) => type.active && type.location_type === 'video'),
    [connections, data],
  );

  const handleNew = () => {
    setEditingMeetingType(null);
    setSeedTemplate(null);
    setIsModalOpen(true);
    onNew?.();
  };

  const handleUseTemplate = (template: MeetingTypeTemplate) => {
    setEditingMeetingType(null);
    setSeedTemplate(template);
    // Close the picker as the form opens, so the two never stack.
    setIsTemplatePickerOpen(false);
    setIsModalOpen(true);
    onNew?.();
  };

  const handleEdit = (meetingType: MeetingType) => {
    setEditingMeetingType(meetingType);
    setSeedTemplate(null);
    setIsModalOpen(true);
    onEdit?.(meetingType);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMeetingType(null);
    setSeedTemplate(null);
  };

  /**
   * Flip a meeting type between active and paused from its card.
   *
   * Sends the WHOLE row with `active` overridden. The update schema defaults
   * omitted fields to null, so a patch-style call here would quietly erase the
   * meeting type's description and address.
   */
  const handleToggleActive = async (meetingType: MeetingType, active: boolean) => {
    try {
      await updateType.mutateAsync({
        ...meetingTypeRowToInput(meetingType),
        id: meetingType.id,
        active,
      });
    } catch {
      /* error is handled by the hook's onError */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteType.mutateAsync(id);
      setConfirmingDelete(null);
    } catch {
      /* error is handled by the hook's onError */
    }
  };

  if (isLoading) return <MeetingTypesSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Could not load meeting types"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  // The modal and the template row mount in every branch, including the empty
  // one: a brand-new user's first create starts from the empty state, and an
  // unmounted modal makes that button a silent no-op.
  const modal = (
    <MeetingTypeModal
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      meetingType={editingMeetingType}
      template={seedTemplate}
    />
  );

  const templatePicker = (
    <MeetingTypeTemplatePicker
      isOpen={isTemplatePickerOpen}
      onClose={() => setIsTemplatePickerOpen(false)}
      onSelect={handleUseTemplate}
    />
  );

  const templateButton = (
    <Button variant="outline" onClick={() => setIsTemplatePickerOpen(true)}>
      Start from a template
    </Button>
  );

  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <Empty
          title="No meeting types yet"
          description="Each meeting type is a link you can send. Couples pick a time that already works for you."
          action={
            <div className="flex items-center gap-2">
              {templateButton}
              <Button onClick={handleNew}>New meeting type</Button>
            </div>
          }
          size="sm"
        />
        {templatePicker}
        {modal}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-section font-semibold text-text">Meeting types</h2>
          <p className="text-body text-text-muted mt-0.5">
            Each one is a link you can send. Couples pick a time that already works for you.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {templateButton}
          <Button onClick={handleNew}>New meeting type</Button>
        </div>
      </div>

      {videoTypesWithoutCalendar && (
        <CalendarConnectNote message="Your video meeting types won't include a join link until a calendar is connected." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((type) => (
          <MeetingTypeCard
            key={type.id}
            meetingType={type}
            bookedThisMonth={bookedThisMonth[type.id] ?? 0}
            onEdit={handleEdit}
            onDelete={(id) => setConfirmingDelete(id)}
            onToggleActive={handleToggleActive}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirmingDelete !== null}
        title="Delete this meeting type?"
        description="Once deleted, couples will no longer be able to book this meeting type."
        onConfirm={() => confirmingDelete && handleDelete(confirmingDelete)}
        onCancel={() => setConfirmingDelete(null)}
        loading={deleteType.isPending}
        confirmLabel="Delete"
        loadingLabel="Deleting..."
      />

      {templatePicker}
      {modal}
    </div>
  );
}

