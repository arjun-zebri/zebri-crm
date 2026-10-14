/**
 * The Details tab of the prospect modal: notes, how to reach them, their
 * sequence, what the checks found, and do-not-contact. Everything the
 * founder edits rarely, kept out of the first view.
 *
 * Do-not-contact asks first, because it stops all outreach to the person.
 *
 * @module features/outreach/views/prospects/prospect-details
 */
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import type { ProspectDetail } from '@/lib/outreach/services/queries';

import { ContactsSection } from './drawer-contacts';
import { DrawerSection } from './drawer-parts';
import { SequenceSection } from './drawer-sequence';
import { SignalsSection } from './drawer-signals';
import { formatSydneyDateTime } from './labels';
import { useDraft } from './use-draft';
import { usePatchProspect } from './use-patch-prospect';

/** Props for {@link ProspectDetails}. */
export interface ProspectDetailsProps {
  detail: ProspectDetail;
}

/** Notes first, then contacts, sequence, checks, and do-not-contact last. */
export function ProspectDetails({ detail }: ProspectDetailsProps) {
  const p = detail.prospect;
  const { patch, saving } = usePatchProspect(p.id);
  const [notes, setNotes] = useDraft(p.notes ?? '');
  const [confirmingDnc, setConfirmingDnc] = useState(false);

  function commitNotes() {
    const next = notes.trim();
    if (next === (p.notes ?? '')) return;
    patch({ notes: next === '' ? null : next }, 'Notes saved');
  }

  return (
    <div className="space-y-8">
      <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={commitNotes} />
      <ContactsSection prospect={p} />
      <SequenceSection prospectId={p.id} enrollment={detail.enrollment} />
      <SignalsSection prospect={p} />
      <DrawerSection title="Other">
        <div className="space-y-4">
          <Toggle
            checked={p.do_not_contact}
            onChange={(checked) => {
              if (checked) setConfirmingDnc(true);
              else patch({ do_not_contact: false }, 'Do not contact turned off');
            }}
            label="Do not contact"
            description="Never emailed or DMed again."
          />
          <p className="flex flex-wrap items-center gap-x-2 text-body text-text-muted">
            Booking ref <span className="text-text">{p.ref_code}</span>
            <CopyButton value={p.ref_code} label="Copy" variant="ghost" />
          </p>
          <p className="text-body text-text-muted">Added {formatSydneyDateTime(p.created_at)}</p>
        </div>
      </DrawerSection>
      <ConfirmDialog
        open={confirmingDnc}
        title={`Stop contacting ${p.full_name}?`}
        description="Zebri will never email or DM them again. You can turn this off later."
        confirmLabel="Do not contact"
        loading={saving}
        onCancel={() => setConfirmingDnc(false)}
        onConfirm={() => patch({ do_not_contact: true }, 'Marked do not contact', () => setConfirmingDnc(false))}
      />
    </div>
  );
}
