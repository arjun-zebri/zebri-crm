'use client';

import { useEffect, useReducer, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import type { Database } from '@/types/database';


import { weekFromRules } from './availability-utils';
import { MeetingTypeAvailabilityFields } from './meeting-type-availability-fields';
import { MeetingTypeFields } from './meeting-type-fields';
import {
  buildMeetingTypePayload,
  DEFAULT_FORM_STATE,
  formReducer,
} from './meeting-type-form';
import type { MeetingTypeTemplate } from './meeting-type-templates';
import { useAvailability } from './use-availability';
import { createFormSetters } from './use-form-dispatch';
import { useMeetingTypeAvailability } from './use-meeting-type-availability';
import {
  useCreateMeetingType,
  useUpdateMeetingType,
} from './use-meeting-types';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

interface MeetingTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingType: MeetingType | null;
  /**
   * Starter values for a NEW meeting type. Ignored when `meetingType` is set,
   * since editing an existing type must never be seeded from a template.
   * Prefilling deliberately does not switch the modal into edit mode: the
   * template has no row behind it, so saving still creates.
   */
  template?: MeetingTypeTemplate | null;
}

/**
 * Create/edit modal for meeting types.
 *
 * Manages form state via useReducer, seeds from `meetingType` prop on open.
 *
 * @module app/(dashboard)/calendar/meeting-type-modal
 */
export function MeetingTypeModal({
  isOpen,
  onClose,
  template = null,
  meetingType,
}: MeetingTypeModalProps) {
  const [form, dispatch] = useReducer(formReducer, DEFAULT_FORM_STATE);
  /**
   * Validation message for the name field.
   *
   * Save used to `return` silently on an empty name, and because the footer
   * button sits outside the `<form>` the browser's own `required` handling
   * never ran either. Pressing Save simply did nothing, with no reason given.
   */
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const createMutation = useCreateMeetingType();
  const updateMutation = useUpdateMeetingType();
  const setters = createFormSetters(dispatch);

  // The MC's standard week seeds the custom grid, and this type's own
  // windows (if any) overwrite that seed once they arrive.
  const { data: standardAvailability } = useAvailability();
  const { data: typeRules } = useMeetingTypeAvailability(
    isOpen && meetingType ? meetingType.id : null,
  );

  useEffect(() => {
    if (!isOpen) return;

    if (meetingType) {
      dispatch({
        type: 'set',
        payload: {
          name: meetingType.name,
          description: meetingType.description ?? '',
          durationMinutes: String(meetingType.duration_minutes),
          locationType: meetingType.location_type,
          address: meetingType.address ?? '',
          // Seeded but not rendered. The form no longer offers buffers, and
          // the payload still sends whatever is in state, so dropping these
          // would silently reset a stored buffer to zero the next time anyone
          // edited the meeting type.
          bufferBeforeMinutes: String(meetingType.buffer_before_minutes),
          bufferAfterMinutes: String(meetingType.buffer_after_minutes),
          minNoticeHours: String(meetingType.min_notice_hours),
          maxAdvanceDays: String(meetingType.max_advance_days),
          reminderEnabled: meetingType.reminder_enabled,
          active: meetingType.active,
          customAvailability: meetingType.uses_custom_availability,
        },
      });
    } else if (template) {
      // Reset first so switching between templates cannot leave stale values
      // from the previous one behind.
      dispatch({ type: 'reset' });
      dispatch({
        type: 'set',
        payload: {
          name: template.name,
          description: template.description,
          durationMinutes: String(template.durationMinutes),
          locationType: template.locationType,
        },
      });
    } else {
      dispatch({ type: 'reset' });
    }
  }, [isOpen, meetingType, template]);

  // Seeding the weekly grid is a separate effect because both sources
  // arrive asynchronously: whichever lands last wins, with the type's own
  // windows preferred over the standard-hours seed.
  useEffect(() => {
    if (!isOpen) return;

    const rules = typeRules && typeRules.length > 0
      ? typeRules
      : (standardAvailability?.rules ?? []);

    dispatch({ type: 'set', payload: { availabilityWeek: weekFromRules(rules) } });
  }, [isOpen, typeRules, standardAvailability]);

  /**
   * Close and drop any validation message.
   *
   * Cleared here rather than on open: clearing in the seeding effect is a
   * setState-in-effect, and every close path (Cancel, X, backdrop, Escape)
   * routes through this, so a reopened modal never shows the last attempt's
   * error.
   */
  const handleClose = () => {
    setNameError(undefined);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Give this meeting type a name.');
      return;
    }
    setNameError(undefined);

    const payload = buildMeetingTypePayload(form);

    try {
      if (meetingType) {
        await updateMutation.mutateAsync({
          id: meetingType.id,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      handleClose();
    } catch (err) {
      // Nothing upstream surfaces this: the create mutation has no `onError`,
      // so a rejected save used to leave the modal sitting there with no
      // message, which reads as a dead button. Say what went wrong instead.
      toast(err instanceof Error ? err.message : 'Could not save this meeting type.', 'error');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const title = meetingType ? 'Edit meeting type' : 'Create meeting type';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button loading={isPending} onClick={handleSubmit}>
            Save
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <MeetingTypeFields
          name={form.name}
          nameError={nameError}
          setName={(value) => {
            if (nameError) setNameError(undefined);
            setters.setName(value);
          }}
          description={form.description}
          setDescription={setters.setDescription}
          durationMinutes={form.durationMinutes}
          setDurationMinutes={setters.setDurationMinutes}
          locationType={form.locationType}
          setLocationType={setters.setLocationType}
          address={form.address}
          setAddress={setters.setAddress}
          minNoticeHours={form.minNoticeHours}
          setMinNoticeHours={setters.setMinNoticeHours}
          maxAdvanceDays={form.maxAdvanceDays}
          setMaxAdvanceDays={setters.setMaxAdvanceDays}
          reminderEnabled={form.reminderEnabled}
          setReminderEnabled={setters.setReminderEnabled}
        />

        <MeetingTypeAvailabilityFields
          custom={form.customAvailability}
          setCustom={(custom) => dispatch({ type: 'set', payload: { customAvailability: custom } })}
          week={form.availabilityWeek}
          setWeek={(week) => dispatch({ type: 'set', payload: { availabilityWeek: week } })}
        />
      </form>
    </Modal>
  );
}
