/**
 * The three small forms opened from the drawer's action row: mark a reply
 * Zebri cannot see, log a manual contact, and link a Zebri account. Each is
 * mounted only while open, so its fields start blank every time.
 *
 * @module features/outreach/views/prospects/drawer-action-dialogs
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { linkUserAction, logTouchAction, markRepliedAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Phone or other' },
];

const TOUCH_OPTIONS: SelectOption[] = [
  { value: 'call', label: 'Call' },
  { value: 'ig_comment', label: 'Instagram comment' },
  { value: 'ig_reply', label: 'Instagram reply' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

/** Props shared by the action dialogs. */
export interface ActionDialogProps {
  prospectId: string;
  onClose: () => void;
}

/** Mark a reply that arrived where Zebri cannot see it. */
export function MarkRepliedDialog({ prospectId, onClose }: ActionDialogProps) {
  const [channel, setChannel] = useState('instagram');
  const [note, setNote] = useState('');
  const m = useOutreachMutation(markRepliedAction, 'Marked replied');
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Mark replied"
      size="sm"
      layer="nested"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={m.isPending} disabled={m.isPending} onClick={() => m.mutate({ id: prospectId, channel, note: note.trim() || undefined }, { onSuccess: onClose })}>
            Mark replied
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select label="Where did they reply?" options={CHANNEL_OPTIONS} value={channel} onValueChange={setChannel} />
        <Input label="Note" value={note} maxLength={2000} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/** Log a call, comment or other contact that Zebri did not send. */
export function LogContactDialog({ prospectId, onClose }: ActionDialogProps) {
  const [kind, setKind] = useState('call');
  const [note, setNote] = useState('');
  const m = useOutreachMutation(logTouchAction, 'Contact logged');
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Log contact"
      size="sm"
      layer="nested"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={m.isPending} disabled={m.isPending} onClick={() => m.mutate({ id: prospectId, kind, note: note.trim() || undefined }, { onSuccess: onClose })}>
            Log contact
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select label="What happened?" options={TOUCH_OPTIONS} value={kind} onValueChange={setKind} />
        <Textarea label="Note" rows={3} value={note} maxLength={2000} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/** Link this prospect to an existing Zebri account by its sign-up email. */
export function LinkUserDialog({ prospectId, onClose }: ActionDialogProps) {
  const [email, setEmail] = useState('');
  const m = useOutreachMutation(linkUserAction, 'Account linked');
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Link Zebri account"
      size="sm"
      layer="nested"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={m.isPending} disabled={!valid || m.isPending} onClick={() => m.mutate({ id: prospectId, email: email.trim() }, { onSuccess: onClose })}>
            Link account
          </Button>
        </div>
      }
    >
      <Input
        label="Sign-up email"
        type="email"
        value={email}
        help="The email the celebrant used to sign up. Marks them as signed up."
        onChange={(e) => setEmail(e.target.value)}
      />
    </Modal>
  );
}
