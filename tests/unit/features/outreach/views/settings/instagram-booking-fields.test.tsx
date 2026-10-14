// tests/unit/features/outreach/views/settings/instagram-booking-fields.test.tsx
/**
 * Settings > Instagram and booking. A missing lookup key reads as a muted
 * note, not a warning, and never names the env var.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SettingsForm } from '@/features/outreach/views/settings/form-model';
import { InstagramBookingFields } from '@/features/outreach/views/settings/instagram-booking-fields';

const form = { budget_dollars: '50', booking_meeting_type_id: 'none' } as unknown as SettingsForm;

function renderFields(apifyConfigured: boolean) {
  return render(
    <InstagramBookingFields
      form={form}
      set={vi.fn()}
      errors={{}}
      meetingTypes={[]}
      apifyConfigured={apifyConfigured}
      usesBooking={false}
    />,
  );
}

describe('Settings Instagram checks notice', () => {
  it('says lookup is off and points to the Vercel key, without naming the env var', () => {
    const { container } = renderFields(false);
    expect(screen.getByText('Instagram lookup is off. Add the Instagram lookup key in Vercel to turn it on.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/APIFY_TOKEN/);
  });

  it('shows no notice when the key is configured, and keeps the budget field', () => {
    renderFields(true);
    expect(screen.queryByText(/Instagram lookup is off/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Instagram lookup budget per month/)).toBeInTheDocument();
  });

  it('uses the quiet section heading', () => {
    renderFields(true);
    expect(screen.getByRole('heading', { name: 'Instagram and booking' })).toHaveClass('text-body', 'font-semibold');
  });
});
