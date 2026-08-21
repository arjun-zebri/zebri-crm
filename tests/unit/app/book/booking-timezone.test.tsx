/**
 * The public booking page renders times in the BOOKER's timezone.
 *
 * Regression: the page took `timezone` straight from the slots endpoint,
 * which returns the MC's zone (defaulting to Australia/Sydney). A Perth
 * couple therefore read Sydney times labelled as their own, and the MC's zone
 * was written to the booking as the booker's, so confirmations and 24h
 * reminders rendered in a zone the couple was never in.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import { BookingSlotColumn } from '@/app/book/[token]/booking-slot-column';
import { BookingTimezoneSelector } from '@/app/book/[token]/booking-timezone-selector';

// 2026-08-21T01:00:00Z = 11:00 Sydney (UTC+10) = 09:00 Perth (UTC+8).
const SLOT = { start: '2026-08-21T01:00:00Z', end: '2026-08-21T01:30:00Z' };

describe('BookingSlotColumn timezone rendering', () => {
  it('renders the slot in whichever zone it is given', () => {
    const { rerender } = render(
      <BookingSlotColumn
        selectedDate="2026-08-21"
        slots={[SLOT]}
        timezone="Australia/Sydney"
        onSelectSlot={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /11:00/ })).toBeInTheDocument();

    rerender(
      <BookingSlotColumn
        selectedDate="2026-08-21"
        slots={[SLOT]}
        timezone="Australia/Perth"
        onSelectSlot={() => {}}
      />,
    );
    // The same instant, read by someone in Perth.
    expect(screen.getByRole('button', { name: /9:00/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /11:00/ })).not.toBeInTheDocument();
  });

  it('names the zone the times belong to', () => {
    render(
      <BookingSlotColumn
        selectedDate="2026-08-21"
        slots={[SLOT]}
        timezone="Australia/Perth"
        onSelectSlot={() => {}}
      />,
    );
    expect(screen.getByText(/All times are in Perth time/i)).toBeInTheDocument();
  });
});

describe('BookingTimezoneSelector', () => {
  it('shows the current zone and can be opened to change it', async () => {
    const user = userEvent.setup();
    render(<BookingTimezoneSelector timezone="Australia/Perth" onTimezoneChange={vi.fn()} />);

    // Why: Zebri cannot know where a couple is, so the guess has to be stated
    // and correctable rather than silently applied.
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent(/Australian Western Standard Time|Australia\/Perth/);

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders nothing before a zone is resolved', () => {
    const { container } = render(
      <BookingTimezoneSelector timezone="" onTimezoneChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
