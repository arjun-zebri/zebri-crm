'use client';

/**
 * The editable settings form. Owns the draft state and the save; the
 * sections own their fields.
 *
 * Validation errors sit under the field they belong to. The form tracks
 * the last saved state, shows an "Unsaved changes" note while the draft
 * differs, and asks the browser to confirm before leaving the page.
 *
 * @module features/outreach/views/settings/settings-form
 */
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { saveSettingsAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { SettingsData } from '@/lib/outreach/services/queries';

import { isFormDirty, toForm, toInput, type FieldErrors, type SettingsForm } from './form-model';
import { InstagramBookingFields } from './instagram-booking-fields';
import { SendingFields } from './sending-fields';

/**
 * @param props.data - The settings view data the page loaded.
 * @param props.usesBooking - True when a live template links to {{booking_link}}.
 */
export function SettingsForm({ data, usesBooking }: { data: SettingsData; usesBooking: boolean }) {
  const { toast } = useToast();
  // Why: the form is seeded once. It used to remount on updated_at, but resuming sending also
  // bumps updated_at, which silently threw away unsaved edits.
  const [initial] = useState(() => toForm(data.settings));
  const [form, setForm] = useState<SettingsForm>(initial);
  const [saved, setSaved] = useState<SettingsForm>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useOutreachMutation(saveSettingsAction, 'Settings saved');
  const dirty = isFormDirty(form, saved);

  // Why: a browser-level prompt is the only guard that covers a reload or a closed tab.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear a field's error as soon as the founder edits it.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = toInput(form);
    if (!next.ok) {
      setErrors(next.errors);
      toast('Check the highlighted fields.', 'error');
      return;
    }
    setErrors({});
    const submitted = form;
    save.mutate(next.data, { onSuccess: () => setSaved(submitted) });
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      <SendingFields form={form} set={set} errors={errors} />
      <InstagramBookingFields
        form={form}
        set={set}
        errors={errors}
        meetingTypes={data.meetingTypes}
        apifyConfigured={data.apifyConfigured}
        usesBooking={usesBooking}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty && (
          <p aria-live="polite" className="mr-auto text-body text-text-muted">
            Unsaved changes
          </p>
        )}
        <Button type="submit" loading={save.isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
