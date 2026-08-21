/**
 * Regression tests for the booking page's loading sequence.
 *
 * A couple opening an MC's link saw three frames: the skeleton, then "No times
 * available for this period", then the times. The middle frame appeared because
 * the picker was revealed as soon as the meeting type loaded, while the slots
 * were still being fetched. An empty slot list mid-request is indistinguishable
 * from a genuinely empty period, so the page told the couple the MC was
 * unavailable before it had the answer.
 *
 * @module tests/unit/app/book/booking-slot-loading
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { BookingSlotPicker } from '@/app/book/[token]/booking-slot-picker';
import type { BookingPageData } from '@/app/book/[token]/use-booking-page';

const bookingPage = {
  name: 'Intro call',
  business_name: 'Test Business',
  duration_minutes: 30,
  location_type: 'video' as const,
  address: null,
  brand_color: '#111827',
} as unknown as BookingPageData;

function renderPicker(overrides: { slotsLoading?: boolean; availableDates?: Set<string> }) {
  return render(
    <BookingSlotPicker
      state="ready"
      slotsLoading={overrides.slotsLoading ?? false}
      bookingPage={bookingPage}
      slotsForSelectedDate={[]}
      availableDates={overrides.availableDates ?? new Set()}
      selectedDate={null}
      currentMonth="2026-09"
      timezone="Australia/Sydney"
      onSelectSlot={vi.fn()}
      onSelectDate={vi.fn()}
      onChangeMonth={vi.fn()}
      onChangeTimezone={vi.fn()}
    />
  );
}

describe('BookingSlotPicker while slots are loading', () => {
  it('does not claim the period is empty before the answer arrives', () => {
    renderPicker({ slotsLoading: true, availableDates: new Set() });

    expect(screen.queryByText(/No times available for this period/i)).not.toBeInTheDocument();
  });

  it('shows the skeleton instead', () => {
    renderPicker({ slotsLoading: true, availableDates: new Set() });

    expect(screen.getByRole('status', { name: 'Loading booking page' })).toBeInTheDocument();
  });

  it('does say the period is empty once the fetch has finished', () => {
    // The message is correct when it is actually true; it just must not be
    // shown while the request is still out.
    renderPicker({ slotsLoading: false, availableDates: new Set() });

    expect(screen.getByText(/No times available for this period/i)).toBeInTheDocument();
  });

  it('shows the picker once dates are available', () => {
    renderPicker({ slotsLoading: false, availableDates: new Set(['2026-09-10']) });

    expect(screen.queryByText(/No times available for this period/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
