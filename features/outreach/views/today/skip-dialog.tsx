/**
 * Small dialog that asks why an Instagram DM is being skipped. The
 * reason is required because it lands on the prospect's timeline.
 *
 * @module features/outreach/views/today/skip-dialog
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

/** Props for {@link SkipDialog}. */
export interface SkipDialogProps {
  /** Name shown in the title. `null` keeps the dialog closed. */
  name: string | null;
  /** Called when the dialog closes without confirming. */
  onClose: () => void;
  /** Called with the trimmed reason when the founder confirms. */
  onConfirm: (reason: string) => void;
  /** True while the skip is saving; disables the confirm button. */
  pending: boolean;
}

/** Reason prompt for skipping one queued DM. */
export function SkipDialog({ name, onClose, onConfirm, pending }: SkipDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  // Reset the field each time a different person is opened: the dialog
  // stays mounted, so without this the last reason would carry over.
  const [forName, setForName] = useState<string | null>(name);
  if (forName !== name) {
    setForName(name);
    setReason('');
  }

  return (
    <Modal
      isOpen={name !== null}
      onClose={onClose}
      title={name ? `Skip ${name}` : 'Skip'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={pending} disabled={!trimmed || pending} onClick={() => onConfirm(trimmed)}>
            Skip this DM
          </Button>
        </div>
      }
    >
      <Input
        label="Why skip?"
        value={reason}
        maxLength={200}
        placeholder="For example: already booked elsewhere"
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
    </Modal>
  );
}
