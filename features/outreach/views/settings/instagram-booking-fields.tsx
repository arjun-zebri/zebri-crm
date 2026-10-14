'use client';

/**
 * Settings > Instagram and booking: the monthly lookup budget, and which
 * meeting type the outreach booking link points at.
 *
 * @module features/outreach/views/settings/instagram-booking-fields
 */
import { Callout } from '@/components/ui/callout';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import type { FieldErrors, SettingsForm } from './form-model';
import { NO_BOOKING } from './form-model';
import { SectionHeading } from './section-heading';
import type { SetField } from './sending-fields';

/**
 * @param props.form - Current form state.
 * @param props.set - Updates one field.
 * @param props.errors - Validation messages from the last save attempt.
 * @param props.meetingTypes - The admin's active meeting types.
 * @param props.apifyConfigured - False when the Instagram lookup key is not set on the server.
 * @param props.usesBooking - True when a live sequence template links to {{booking_link}}.
 */
export function InstagramBookingFields({
  form,
  set,
  errors,
  meetingTypes,
  apifyConfigured,
  usesBooking,
}: {
  form: SettingsForm;
  set: SetField;
  errors: FieldErrors;
  meetingTypes: { id: string; name: string; bookingUrl: string }[];
  apifyConfigured: boolean;
  usesBooking: boolean;
}) {
  const options: SelectOption[] = [
    { value: NO_BOOKING, label: 'None' },
    ...meetingTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const bookingUrl = meetingTypes.find((t) => t.id === form.booking_meeting_type_id)?.bookingUrl ?? null;
  const noBookingPage = form.booking_meeting_type_id === NO_BOOKING;

  return (
    <section id="instagram-booking" className="space-y-6 scroll-mt-6">
      <SectionHeading
        title="Instagram and booking"
        description="The monthly lookup budget, and the booking page outreach emails link to."
      />
      {/* Why: a missing key is a setup gap the developer fixes, not a warning the founder can act on. */}
      {!apifyConfigured && (
        <p className="text-body text-text-muted">Instagram lookup is off. Add the Instagram lookup key in Vercel to turn it on.</p>
      )}
      <Input
        label="Instagram lookup budget per month (US$)"
        help="Lookups stop for the month once this is spent. Amounts are in US dollars."
        inputMode="decimal"
        value={form.budget_dollars}
        error={errors.budget_dollars}
        onChange={(e) => set('budget_dollars', e.target.value)}
      />
      <div className="space-y-3">
        <Select
          label="Booking page"
          help="The meeting type that outreach emails link to."
          options={options}
          value={form.booking_meeting_type_id}
          onValueChange={(v) => set('booking_meeting_type_id', v)}
        />
        {usesBooking && noBookingPage && (
          <Callout tone="warning">
            A sequence template uses {'{{booking_link}}'}, but no booking page is chosen. Campaigns that use that template
            cannot activate until you pick one.
          </Callout>
        )}
        {noBookingPage && !usesBooking && <p className="text-body text-text-muted">Emails will not include a booking link.</p>}
        {bookingUrl && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body text-text-muted break-all">{bookingUrl}?ref=…</span>
            <CopyButton value={bookingUrl} label="Copy link" />
          </div>
        )}
      </div>
    </section>
  );
}
