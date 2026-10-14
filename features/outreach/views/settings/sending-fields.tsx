'use client';

/**
 * Settings > Sending: who emails come from, what they say, how fast
 * they go out, and when.
 *
 * @module features/outreach/views/settings/sending-fields
 */
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeSelect } from '@/components/ui/time-select';

import type { FieldErrors, SettingsForm } from './form-model';
import { SectionHeading } from './section-heading';

/** Monday first, with the ISO weekday number the server stores. */
const WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

/** Setter for one form field, typed per key. */
export type SetField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;

/**
 * @param props.form - Current form state.
 * @param props.set - Updates one field.
 * @param props.errors - Validation messages from the last save attempt.
 */
export function SendingFields({ form, set, errors }: { form: SettingsForm; set: SetField; errors: FieldErrors }) {
  function toggleDay(iso: number, on: boolean) {
    const next = on ? [...form.send_weekdays, iso] : form.send_weekdays.filter((d) => d !== iso);
    set('send_weekdays', next);
  }

  return (
    <section id="sending" className="space-y-6 scroll-mt-6">
      <SectionHeading title="Sending" description="Who emails come from, what they say, and how fast they go out." />
      <Input
        label="Sender name"
        help="Shown as the name emails come from."
        value={form.sender_name}
        onChange={(e) => set('sender_name', e.target.value)}
      />
      <Textarea
        label="Signature"
        help="Your name, Zebri, and website. Every email must say who it's from."
        rows={4}
        value={form.signature}
        onChange={(e) => set('signature', e.target.value)}
      />
      <Input
        label="Daily email limit while the inbox warms up"
        help="One number per week, like 5, 10, 20, 30. The last number stays after the list ends."
        value={form.ramp}
        error={errors.ramp}
        onChange={(e) => set('ramp', e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="Daily email cap"
          help="The most emails sent in one day, whatever the ramp says."
          inputMode="numeric"
          value={form.email_daily_cap}
          error={errors.email_daily_cap}
          onChange={(e) => set('email_daily_cap', e.target.value)}
        />
        <Input
          label="Daily Instagram DM cap"
          help="The most Instagram messages queued for you in one day."
          inputMode="numeric"
          value={form.ig_daily_cap}
          error={errors.ig_daily_cap}
          onChange={(e) => set('ig_daily_cap', e.target.value)}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-body font-medium text-text mb-1">Send window</legend>
        <div className="grid grid-cols-2 gap-6">
          <TimeSelect
            value={form.send_window_start}
            onChange={(v) => set('send_window_start', v)}
            minuteStep={30}
            startHour={0}
            endHour={23}
            placeholder="Start"
          />
          <TimeSelect
            value={form.send_window_end}
            onChange={(v) => set('send_window_end', v)}
            minuteStep={30}
            startHour={0}
            endHour={23}
            placeholder="End"
          />
        </div>
        <p className="text-body text-text-muted">Messages only go out inside this window.</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-body font-medium text-text mb-3">Send on</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {WEEKDAYS.map((d) => (
            <Checkbox
              key={d.iso}
              checked={form.send_weekdays.includes(d.iso)}
              onChange={(on) => toggleDay(d.iso, on)}
              label={d.label}
            />
          ))}
        </div>
      </fieldset>
    </section>
  );
}
