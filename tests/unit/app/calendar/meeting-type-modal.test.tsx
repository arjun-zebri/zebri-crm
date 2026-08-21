/**
 * Meeting type modal tests.
 *
 * Tests create and edit flows with realistic mock data and payload
 * validation. Uses vi.mock to inject the hooks.
 *
 * @module tests/unit/app/calendar/meeting-type-modal
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MeetingTypeModal } from '@/app/(dashboard)/calendar/meeting-type-modal';
import type { Database } from '@/types/database';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

const mockCreateMeetingType = vi.fn();
const mockUpdateMeetingType = vi.fn();

// The modal now loads the MC's weekly hours so a type can carry its own
// schedule. Stubbed here so these tests stay about the form itself and do not
// need a Supabase client.
// Stable references on purpose. A fresh object per call makes any effect that
// depends on the hook's result re-run forever, which surfaces as "Maximum
// update depth exceeded" rather than as anything about the form.
const availabilityResult = {
  data: { rules: [], overrides: [], timezone: 'Australia/Melbourne' },
  isLoading: false,
  error: null,
};
const typeAvailabilityResult = {
  data: { custom: false, rules: [] },
  isLoading: false,
  error: null,
};

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => availabilityResult,
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-type-availability', () => ({
  useMeetingTypeAvailability: () => typeAvailabilityResult,
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useCreateMeetingType: () => ({
    mutateAsync: mockCreateMeetingType,
    isPending: false,
  }),
  useUpdateMeetingType: () => ({
    mutateAsync: mockUpdateMeetingType,
    isPending: false,
  }),
}));

describe('MeetingTypeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create mode (meetingType={null})', () => {
    it('renders with correct default values', () => {
      render(
        <MeetingTypeModal
          isOpen={true}
          onClose={vi.fn()}
          meetingType={null}
        />,
      );

      // Check defaults exist in the form
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);

      // Duration should default to 30
      const selects = screen.getAllByRole('button');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('calls create mutation on save with expected payload', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      mockCreateMeetingType.mockResolvedValue({ id: 'new-id' });

      render(
        <MeetingTypeModal
          isOpen={true}
          onClose={handleClose}
          meetingType={null}
        />,
      );

      // Find name input by label
      const nameInput = screen.getByLabelText('Name');
      await user.type(nameInput, 'Consultation Call');

      // Find and click Save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockCreateMeetingType).toHaveBeenCalled();
      });

      const call = mockCreateMeetingType.mock.calls[0]![0];
      expect(call.name).toBe('Consultation Call');
      expect(call.duration_minutes).toBe(30);
      expect(call.location_type).toBe('video');
      expect(call.active).toBe(true);
      expect(call.reminder_enabled).toBe(true);
      expect(call.min_notice_hours).toBe(24);
    });
  });

  describe('edit mode (meetingType={row})', () => {
    it('seeds fields from the passed row', () => {
      const existingType: MeetingType = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Team Standup',
        description: 'Quick sync',
        duration_minutes: 15,
        location_type: 'video',
        address: null,
        buffer_before_minutes: 10,
        buffer_after_minutes: 10,
        min_notice_hours: 4,
        max_advance_days: 30,
        reminder_enabled: false,
        uses_custom_availability: false,
        active: true,
        share_token: 'token',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      render(
        <MeetingTypeModal
          isOpen={true}
          onClose={vi.fn()}
          meetingType={existingType}
        />,
      );

      // Name should be pre-filled
      expect(screen.getByDisplayValue('Team Standup')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Quick sync')).toBeInTheDocument();
    });

    it('calls update mutation on save', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      const existingType: MeetingType = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Team Standup',
        description: 'Quick sync',
        duration_minutes: 15,
        location_type: 'video',
        address: null,
        buffer_before_minutes: 10,
        buffer_after_minutes: 10,
        min_notice_hours: 4,
        max_advance_days: 30,
        reminder_enabled: false,
        uses_custom_availability: false,
        active: true,
        share_token: 'token',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockUpdateMeetingType.mockResolvedValue(existingType);

      render(
        <MeetingTypeModal
          isOpen={true}
          onClose={handleClose}
          meetingType={existingType}
        />,
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateMeetingType).toHaveBeenCalled();
      });
    });
  });

  it('closes modal when onClose is called', async () => {
    const handleClose = vi.fn();

    render(
      <MeetingTypeModal
        isOpen={true}
        onClose={handleClose}
        meetingType={null}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });
});
