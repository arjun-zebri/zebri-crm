/**
 * The duration ladder on the meeting type form.
 *
 * A wedding MC's planning or rehearsal session runs well past the old 2 hour
 * ceiling, so the list has to reach 5 hours. The DB check constraint allows
 * 5-480 minutes, so 300 needs no schema change.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { MeetingTypeFieldsBasics } from '@/app/(dashboard)/calendar/meeting-type-fields-basics';

function renderFields() {
  return render(
    <MeetingTypeFieldsBasics
      name=""
      setName={() => {}}
      description=""
      setDescription={() => {}}
      durationMinutes="30"
      setDurationMinutes={() => {}}
      locationType="video"
      setLocationType={() => {}}
      address=""
      setAddress={() => {}}
    />,
  );
}

describe('Duration options', () => {
  beforeAll(() => {
    // Radix Select reaches for pointer-capture APIs jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  it('offers every step from 15 minutes up to 5 hours', async () => {
    const user = userEvent.setup();
    renderFields();

    await user.click(screen.getByRole('combobox', { name: /duration/i }));

    const listbox = await screen.findByRole('listbox');
    const offered = within(listbox)
      .getAllByRole('option')
      .map((o) => o.textContent);

    expect(offered).toEqual([
      '15 minutes',
      '30 minutes',
      '45 minutes',
      '1 hour',
      '1.5 hours',
      '2 hours',
      '2.5 hours',
      '3 hours',
      '4 hours',
      '5 hours',
    ]);
  });
});
