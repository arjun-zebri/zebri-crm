/**
 * The prospect modal's "more" menu: mark replied, log a contact, link an
 * account, delete. They are occasional, so they live behind one menu
 * button rather than buttons competing with the content. Each opens one
 * small dialog that does the work.
 *
 * @module features/outreach/views/prospects/drawer-actions
 */
import { Link2, MessageSquare, Phone, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';

import { deleteProspectAction } from '../../actions';
import { useOutreachMutation } from '../../hooks';

import { LinkUserDialog, LogContactDialog, MarkRepliedDialog } from './drawer-action-dialogs';

type Dialog = 'replied' | 'contact' | 'link' | 'delete' | null;

/** Props for {@link DrawerActions}. */
export interface DrawerActionsProps {
  prospectId: string;
  /** Person's name, used in the trigger's accessible label. */
  name?: string;
  /** Called once the prospect is deleted, so the modal can close. */
  onDeleted: () => void;
}

/** A "more" menu with the occasional actions. */
export function DrawerActions({ prospectId, name, onDeleted }: DrawerActionsProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const remove = useOutreachMutation(deleteProspectAction, 'Prospect deleted');
  const close = () => setDialog(null);
  const icon = (I: typeof Phone) => <I size={14} strokeWidth={1.5} aria-hidden="true" />;
  return (
    <>
      <RowActionsMenu
        alwaysVisible
        label={`More actions for ${name ?? 'this prospect'}`}
        actions={[
          { label: 'Mark replied', icon: icon(MessageSquare), onSelect: () => setDialog('replied') },
          { label: 'Log contact', icon: icon(Phone), onSelect: () => setDialog('contact') },
          { label: 'Link Zebri account', icon: icon(Link2), onSelect: () => setDialog('link') },
          { label: 'Delete prospect', icon: icon(Trash2), destructive: true, onSelect: () => setDialog('delete') },
        ]}
      />
      {dialog === 'replied' && <MarkRepliedDialog prospectId={prospectId} onClose={close} />}
      {dialog === 'contact' && <LogContactDialog prospectId={prospectId} onClose={close} />}
      {dialog === 'link' && <LinkUserDialog prospectId={prospectId} onClose={close} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this prospect?"
        description="Removes them with their messages and history. If they opted out, they stay on the do-not-contact list."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={close}
        onConfirm={() => remove.mutate(prospectId, { onSuccess: onDeleted, onSettled: close })}
      />
    </>
  );
}
