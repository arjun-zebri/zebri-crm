'use client';

/**
 * "Add prospect": put one person into Outreach by hand, for someone met
 * at a wedding or found on Instagram rather than in the sheet. Only the
 * name is required. Fields are checked as you save with the same rules the
 * server uses, so a typo shows under its field instead of in a toast.
 *
 * Mounted only while open, so the form starts blank every time.
 *
 * @module features/outreach/views/prospects/add-prospect-dialog
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { addProspectAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import { buildManualProspect, type ManualFieldError, type ManualProspectInput } from '@/lib/outreach/import/manual';
import { AU_STATES } from '@/lib/outreach/import/normalise';

/** Sentinel for "no state". Select cannot hold an empty string value. */
const NONE = 'none';
const STATE_OPTIONS: SelectOption[] = [{ value: NONE, label: 'Not set' }, ...AU_STATES.map((s) => ({ value: s, label: s }))];

const BLANK: Required<{ [K in keyof ManualProspectInput]: string }> = {
  full_name: '', state: NONE, suburb: '', email: '', instagram: '', website: '', phone: '', notes: '',
};

/** Props for {@link AddProspectDialog}. */
export interface AddProspectDialogProps {
  onClose: () => void;
  /** Called with the new prospect's id, so the page can open it. */
  onAdded: (id: string) => void;
}

/** The form. Saves, closes, and hands back the new id. */
export function AddProspectDialog({ onClose, onAdded }: AddProspectDialogProps) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Partial<Record<ManualFieldError, string>>>({});
  const { toast } = useToast();
  const add = useOutreachMutation(addProspectAction);
  const set = (key: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function save() {
    const input = { ...form, state: form.state === NONE ? null : form.state };
    const built = buildManualProspect(input);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    // Why: send what the builder normalised (trimmed name, cleaned email and handle), not the raw typing.
    const p = built.prospect;
    const normalised = {
      full_name: p.full_name,
      state: p.state,
      suburb: p.suburb,
      email: p.email,
      instagram: p.instagram_handle,
      website: p.website,
      phone: p.phone,
      notes: form.notes.trim() || null,
    };
    add.mutate(normalised, {
      onSuccess: (r) => {
        toast(`${p.full_name} added`, 'success');
        onAdded(r.id);
      },
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add prospect"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={add.isPending} disabled={add.isPending} onClick={save}>Add prospect</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" required value={form.full_name} onChange={set('full_name')} error={errors.full_name} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Suburb" value={form.suburb} onChange={set('suburb')} />
          <Select label="State" options={STATE_OPTIONS} value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v || NONE }))} />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="name@example.com" />
        <Input label="Instagram" value={form.instagram} onChange={set('instagram')} error={errors.instagram} placeholder="@handle or profile link" />
        <Input label="Website" value={form.website} onChange={set('website')} error={errors.website} placeholder="example.com.au" />
        <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="04xx xxx xxx" />
        <Textarea label="Notes" rows={3} value={form.notes} onChange={set('notes')} placeholder="Where you met them, anything worth remembering" />
        <p className="text-body text-text-muted">They start as not checked yet. The next check looks at their website and Instagram.</p>
      </div>
    </Modal>
  );
}
