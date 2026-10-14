/**
 * The prospect modal's "more" menu: mark replied, log a contact, link an
 * account. They are occasional, so they live behind one menu button
 * rather than three buttons competing with the content. Each opens one
 * small dialog that does the work.
 *
 * @module features/outreach/views/prospects/drawer-actions
 */
import { Link2, MessageSquare, Phone } from 'lucide-react';
import { useState } from 'react';

import { RowActionsMenu } from '@/components/ui/row-actions-menu';

import { LinkUserDialog, LogContactDialog, MarkRepliedDialog } from './drawer-action-dialogs';

type Dialog = 'replied' | 'contact' | 'link' | null;

/** Props for {@link DrawerActions}. */
export interface DrawerActionsProps {
  prospectId: string;
  /** Person's name, used in the trigger's accessible label. */
  name?: string;
}

/** A "more" menu with the three occasional actions. */
export function DrawerActions({ prospectId, name }: DrawerActionsProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
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
        ]}
      />
      {dialog === 'replied' && <MarkRepliedDialog prospectId={prospectId} onClose={close} />}
      {dialog === 'contact' && <LogContactDialog prospectId={prospectId} onClose={close} />}
      {dialog === 'link' && <LinkUserDialog prospectId={prospectId} onClose={close} />}
    </>
  );
}
