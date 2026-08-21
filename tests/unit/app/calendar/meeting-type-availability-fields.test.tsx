/**
 * Unit tests for the per-meeting-type availability section: the standard
 * vs custom switch and the compact weekly grid it reveals.
 *
 * @module tests/unit/app/calendar/meeting-type-availability-fields
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { weekFromRules, type WeekState } from '@/app/(dashboard)/calendar/availability-utils';
import { MeetingTypeAvailabilityFields } from '@/app/(dashboard)/calendar/meeting-type-availability-fields';

/** Monday 9-5, the seed an MC's standard hours would supply. */
function mondayNineToFive(): WeekState {
  return weekFromRules([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
}

/** Renders the section with real state so edits can be observed. */
function Harness({ initialCustom = false }: { initialCustom?: boolean }) {
  const [custom, setCustom] = useState(initialCustom);
  const [week, setWeek] = useState<WeekState>(mondayNineToFive);

  return (
    <MeetingTypeAvailabilityFields
      custom={custom}
      setCustom={setCustom}
      week={week}
      setWeek={setWeek}
    />
  );
}

describe('MeetingTypeAvailabilityFields', () => {
  it('defaults to the standard hours, with no grid on show', () => {
    render(<Harness />);

    expect(screen.getByRole('switch', { name: /use my standard hours/i })).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Enable Monday' })).not.toBeInTheDocument();
    expect(screen.getByText(/follows the weekly hours on your Availability tab/i)).toBeInTheDocument();
  });

  it('reveals the seven-day grid when the switch is turned off', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('switch', { name: /use my standard hours/i }));

    // Rows read "Mon"…"Sun" at modal width; the switch keeps the full name
    // so screen readers still hear "Enable Monday".
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Enable Monday' })).toBeInTheDocument();
    expect(screen.getByText(/bookable only during the hours below/i)).toBeInTheDocument();
  });

  it('starts from the hours it was seeded with rather than an empty week', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('switch', { name: /use my standard hours/i }));

    expect(screen.getByRole('switch', { name: 'Enable Monday' })).toBeChecked();
    expect(screen.getByText('8h bookable')).toBeInTheDocument();
  });

  it('edits the week in place and retotals', async () => {
    const user = userEvent.setup();
    render(<Harness initialCustom />);

    await user.click(screen.getByRole('switch', { name: 'Enable Saturday' }));

    expect(screen.getByText('16h bookable')).toBeInTheDocument();
  });

  it('says date overrides still apply, since they are not editable here', () => {
    render(<Harness initialCustom />);

    expect(screen.getByText(/date overrides still apply/i)).toBeInTheDocument();
  });

  it('reports switching back to standard hours to its caller', async () => {
    const user = userEvent.setup();
    const setCustom = vi.fn();

    render(
      <MeetingTypeAvailabilityFields
        custom
        setCustom={setCustom}
        week={mondayNineToFive()}
        setWeek={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('switch', { name: /use my standard hours/i }));

    expect(setCustom).toHaveBeenCalledWith(false);
  });
});
