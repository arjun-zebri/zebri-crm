/**
 * Booking form section of the meeting type modal.
 *
 * Drives the real modal with the hooks mocked, so the tests cover what an MC
 * does: add, reorder and remove questions, insert presets, lock a mapped type,
 * and get stopped at Save by an invalid question.
 *
 * @module tests/unit/app/calendar/meeting-type-booking-form
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import { MeetingTypeModal } from '@/app/(dashboard)/calendar/meeting-type-modal';
import { MEETING_TYPE_TEMPLATES } from '@/app/(dashboard)/calendar/meeting-type-templates';
import type { Database } from '@/types/database';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

const availabilityResult = {
  data: { rules: [], overrides: [], timezone: 'Australia/Melbourne' },
  isLoading: false,
  error: null,
};
const typeAvailabilityResult = { data: { custom: false, rules: [] }, isLoading: false, error: null };

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => availabilityResult,
}));
vi.mock('@/app/(dashboard)/calendar/use-meeting-type-availability', () => ({
  useMeetingTypeAvailability: () => typeAvailabilityResult,
}));
vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useCreateMeetingType: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateMeetingType: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

const existingRow = (overrides: Partial<MeetingType> = {}): MeetingType => ({
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 'user-1',
  name: 'Consultation',
  description: null,
  duration_minutes: 30,
  location_type: 'video',
  address: null,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 24,
  max_advance_days: 60,
  reminder_enabled: true,
  uses_custom_availability: false,
  active: true,
  share_token: 'token',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  phone_field: 'optional',
  questions: [],
  ...overrides,
});

function renderModal(meetingType: MeetingType | null = null, template: (typeof MEETING_TYPE_TEMPLATES)[number] | null = null) {
  return render(
    <MeetingTypeModal
      isOpen={true}
      onClose={vi.fn()}
      meetingType={meetingType}
      template={template}
    />,
  );
}

/** The expanded row editor is the one containing the "Question" label input. */
async function openNewQuestion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /add question/i }));
  return screen.getByLabelText('Question');
}

describe('MeetingTypeModal booking form', () => {
  beforeAll(() => {
    // Radix Select reaches for pointer-capture APIs jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'new-id' });
    mockUpdate.mockResolvedValue({ id: 'updated' });
  });

  it('explains that name and email are always asked', () => {
    renderModal();
    expect(
      screen.getByText('Name and email are always asked. Add anything else you need to know before the meeting.'),
    ).toBeInTheDocument();
  });

  it('adds a question and saves it in the payload', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText('Name'), 'Consultation');
    const label = await openNewQuestion(user);
    await user.type(label, 'Which venue?');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const payload = mockCreate.mock.calls[0]![0];
    expect(payload.questions).toHaveLength(1);
    expect(payload.questions[0]).toMatchObject({ label: 'Which venue?', type: 'short_text', required: false });
    expect(payload.phone_field).toBe('optional');
  });

  it('removes a question with its delete button', async () => {
    const user = userEvent.setup();
    renderModal();
    await openNewQuestion(user);
    await user.click(screen.getByRole('button', { name: /delete question 1/i }));
    expect(screen.getByText(/no extra questions/i)).toBeInTheDocument();
  });

  it('reorders questions with the move buttons', async () => {
    const user = userEvent.setup();
    renderModal(
      existingRow({
        questions: [
          { id: 'a', label: 'First', type: 'short_text', required: false },
          { id: 'b', label: 'Second', type: 'short_text', required: false },
        ],
      }),
    );
    await user.click(screen.getByRole('button', { name: /move question 2 up/i }));

    const rows = screen.getAllByRole('button', { expanded: false }).filter((b) =>
      /First|Second/.test(b.textContent ?? ''),
    );
    expect(rows.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Second'),
      expect.stringContaining('First'),
    ]);
  });

  it('inserts a preset and reports the questions it skipped', async () => {
    const user = userEvent.setup();
    renderModal(
      existingRow({
        questions: [{ id: 'mine', label: 'Their partner', type: 'short_text', required: false, maps_to: 'partner_name' }],
      }),
    );
    await user.click(screen.getByRole('button', { name: /add a preset/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Wedding' }).catch(() => screen.findByText('Wedding')));

    expect(await screen.findByText(/Skipped Partner's name/)).toBeInTheDocument();
    expect(screen.getByText('Wedding date')).toBeInTheDocument();
    expect(screen.getByText('Venue')).toBeInTheDocument();
  });

  it('locks the answer type once a contact mapping is chosen', async () => {
    const user = userEvent.setup();
    renderModal();
    await openNewQuestion(user);

    await user.click(screen.getByRole('combobox', { name: /also save to contact as/i }));
    await user.click(await screen.findByRole('option', { name: 'Event date' }));

    expect(screen.getByRole('combobox', { name: /answer type/i })).toBeDisabled();
  });

  it('disables a mapping that another question already uses', async () => {
    const user = userEvent.setup();
    renderModal(
      existingRow({
        questions: [{ id: 'mine', label: 'Venue', type: 'short_text', required: false, maps_to: 'venue' }],
      }),
    );
    await openNewQuestion(user);
    await user.click(screen.getByRole('combobox', { name: /also save to contact as/i }));
    const option = await screen.findByRole('option', { name: 'Venue' });
    expect(option).toHaveAttribute('data-disabled');
  });

  it('blocks Save on an empty question and shows the message on its row', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText('Name'), 'Consultation');
    await openNewQuestion(user);

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Every question needs a label');
  });

  it('blocks Save on a choice question with fewer than two options', async () => {
    const user = userEvent.setup();
    renderModal(
      existingRow({
        questions: [{ id: 'pick', label: 'Pick', type: 'single_choice', required: false, options: ['Only'] }],
      }),
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/two options/i);
  });

  it('seeds the list and phone mode from an existing row', async () => {
    renderModal(
      existingRow({
        phone_field: 'required',
        questions: [{ id: 'venue', label: 'Venue', type: 'short_text', required: true, maps_to: 'venue' }],
      }),
    );
    const section = screen.getByRole('heading', { name: 'Booking form' }).closest('section');
    expect(section).not.toBeNull();
    expect(within(section!).getByText('Venue')).toBeInTheDocument();
    // Radix does not render the selected label in jsdom, so the seeded phone
    // mode is checked through what Save sends.
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0]![0]).toMatchObject({
      phone_field: 'required',
      questions: [expect.objectContaining({ label: 'Venue', maps_to: 'venue' })],
    });
  });

  it('keeps a stored question that breaks a rule, so Save can point at it', async () => {
    const user = userEvent.setup();
    renderModal(
      existingRow({
        questions: [{ id: 'pick', label: 'Pick', type: 'single_choice', required: false, options: ['Only'] }],
      }),
    );
    expect(screen.getByText('Pick')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('seeds the list from a template', () => {
    renderModal(null, MEETING_TYPE_TEMPLATES[0]!);
    expect(screen.getByText("Partner's name")).toBeInTheDocument();
    expect(screen.getByText('Wedding date')).toBeInTheDocument();
  });
});
