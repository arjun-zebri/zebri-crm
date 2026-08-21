/**
 * Meeting type card tests.
 *
 * @module tests/unit/app/calendar/meeting-type-card
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { MeetingTypeCard } from '@/app/(dashboard)/calendar/meeting-type-card';
import { meetingTypeRowToInput } from '@/app/(dashboard)/calendar/meeting-type-schema';
import {
  MEETING_TYPE_TEMPLATES,
  templateDurationLabel,
} from '@/app/(dashboard)/calendar/meeting-type-templates';
import type { Database } from '@/types/database';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

const baseType: MeetingType = {
  id: 'mt-1',
  user_id: 'user-1',
  name: 'Intro call',
  description: 'First chat with a couple.',
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
  share_token: 'tok-abc',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

describe('MeetingTypeCard', () => {
  it('shows the name, duration and how the meeting happens', () => {
    render(<MeetingTypeCard meetingType={baseType} bookedThisMonth={0} />);

    expect(screen.getByText('Intro call')).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.getByText(/video/)).toBeInTheDocument();
  });

  it('marks an active type Active and an inactive one Paused', () => {
    const { rerender } = render(
      <MeetingTypeCard meetingType={baseType} bookedThisMonth={0} />
    );
    expect(screen.getByText('Active')).toBeInTheDocument();

    rerender(
      <MeetingTypeCard meetingType={{ ...baseType, active: false }} bookedThisMonth={0} />
    );
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('reads naturally at zero rather than saying "0 booked"', () => {
    render(<MeetingTypeCard meetingType={baseType} bookedThisMonth={0} />);

    expect(screen.getByText('Not booked this month')).toBeInTheDocument();
  });

  it('reports the count when there have been bookings', () => {
    render(<MeetingTypeCard meetingType={baseType} bookedThisMonth={12} />);

    expect(screen.getByText('12 booked this month')).toBeInTheDocument();
  });

  it('hands the meeting type back when edit is pressed', async () => {
    const onEdit = vi.fn();
    render(
      <MeetingTypeCard meetingType={baseType} bookedThisMonth={0} onEdit={onEdit} />
    );

    await userEvent.click(screen.getByTestId('meeting-type-edit-mt-1'));

    expect(onEdit).toHaveBeenCalledWith(baseType);
  });

  it('renders a type whose location is unrecognised without crashing', () => {
    // location_type is a plain text column, so a value the UI does not know
    // about is possible and must degrade rather than throw.
    render(
      <MeetingTypeCard
        meetingType={{ ...baseType, location_type: 'hologram' }}
        bookedThisMonth={0}
      />
    );

    expect(screen.getByText(/hologram/)).toBeInTheDocument();
  });
});

describe('meeting type templates', () => {
  it('offers only 30 minute and 1 hour meetings', () => {
    // Odd durations produce calendars that never line up, so the starter set
    // is deliberately restricted to the two lengths that fit a working day.
    for (const template of MEETING_TYPE_TEMPLATES) {
      expect([30, 60]).toContain(template.durationMinutes);
    }
  });

  it('says "1 hour" rather than "60 min"', () => {
    expect(templateDurationLabel(60)).toBe('1 hour');
    expect(templateDurationLabel(30)).toBe('30 min');
  });

  it('gives every template a unique id', () => {
    // Ids are React keys and test hooks; a duplicate would silently drop one.
    const ids = MEETING_TYPE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes every template', () => {
    for (const template of MEETING_TYPE_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
  });
});

describe('MeetingTypeCard status toggle', () => {
  it('shows a switch reflecting the current state', () => {
    const { rerender } = render(
      <MeetingTypeCard meetingType={baseType} bookedThisMonth={0} />
    );
    expect(screen.getByRole('switch')).toBeChecked();

    rerender(
      <MeetingTypeCard meetingType={{ ...baseType, active: false }} bookedThisMonth={0} />
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('asks to pause an active type when flipped', async () => {
    const onToggleActive = vi.fn();
    render(
      <MeetingTypeCard
        meetingType={baseType}
        bookedThisMonth={0}
        onToggleActive={onToggleActive}
      />
    );

    await userEvent.click(screen.getByRole('switch'));

    expect(onToggleActive).toHaveBeenCalledWith(baseType, false);
  });

  it('asks to activate a paused type when flipped', async () => {
    const onToggleActive = vi.fn();
    const paused = { ...baseType, active: false };
    render(
      <MeetingTypeCard
        meetingType={paused}
        bookedThisMonth={0}
        onToggleActive={onToggleActive}
      />
    );

    await userEvent.click(screen.getByRole('switch'));

    expect(onToggleActive).toHaveBeenCalledWith(paused, true);
  });
});

describe('meetingTypeRowToInput', () => {
  it('carries every field the update schema expects', () => {
    // The update path defaults omitted fields to null, so flipping `active`
    // from a card with a patch-style payload would erase the description and
    // the address. Starting from the row is what prevents that.
    const input = meetingTypeRowToInput(baseType);

    // uses_custom_availability is deliberately absent. It is not part of the
    // update input: the action only writes it when an `availability` block is
    // supplied, precisely so that pausing a type from its card cannot reset a
    // custom schedule the card knows nothing about.
    expect(input).toEqual({
      name: 'Intro call',
      description: 'First chat with a couple.',
      duration_minutes: 30,
      location_type: 'video',
      address: null,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_hours: 24,
      max_advance_days: 60,
      reminder_enabled: true,
      active: true,
    });
  });

  it('preserves a description and address through an active flip', () => {
    const withDetails = {
      ...baseType,
      description: 'Meet at the chapel.',
      address: '1 Church St',
      location_type: 'in_person',
      buffer_before_minutes: 15,
    };

    const payload = { ...meetingTypeRowToInput(withDetails), active: false };

    expect(payload.description).toBe('Meet at the chapel.');
    expect(payload.address).toBe('1 Church St');
    expect(payload.buffer_before_minutes).toBe(15);
    expect(payload.active).toBe(false);
  });
});
