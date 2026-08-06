'use client';

import { Trash2, UserCog } from 'lucide-react';
import { useState, useTransition } from 'react';

import { deleteUser, enterShadow, sendPasswordReset } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import type { AdminUser } from '@/lib/admin/admin-analytics';

/**
 * Account levers. Safe actions (password reset + shadow mode) live
 * inline; the destructive Delete button is visually separated as a
 * "Danger zone" so it can't be mis-clicked.
 *
 * All three actions audit-log and (for shadow + delete) Slack-alert
 * via the wrappers added in Phase 13.
 */
export function AccountActionsSection({
  user,
  onClose,
  onRefresh,
}: {
  user: AdminUser;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  const handlePasswordReset = async () => {
    try {
      const { recoveryLink } = await sendPasswordReset(user.id);
      if (recoveryLink) {
        await navigator.clipboard.writeText(recoveryLink).catch(() => {});
        toast('Recovery link copied to clipboard');
      } else {
        toast('Recovery email sent');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send reset', 'error');
    }
  };

  const handleEnterShadow = () => {
    startTransition(async () => {
      try {
        await enterShadow(user.id);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to enter shadow mode', 'error');
      }
    });
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteUser(user.id);
      toast('User deleted');
      onClose();
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete user', 'error');
    }
  };

  return (
    <>
      <section>
        <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted mb-3">
          Account
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleEnterShadow} variant="secondary" size="sm">
            <UserCog size={14} strokeWidth={1.5} />
            Enter shadow mode
          </Button>
          <Button onClick={handlePasswordReset} variant="secondary" size="sm">
            Send password reset
          </Button>
        </div>
      </section>

      <section className="pt-4 border-t border-border">
        <h3 className="text-caption font-medium uppercase tracking-wide text-danger mb-3">
          Danger zone
        </h3>
        <Button onClick={() => setConfirmDelete(true)} variant="danger" size="sm">
          <Trash2 size={14} strokeWidth={1.5} />
          Delete user
        </Button>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user.email}?`}
        description="This permanently removes the user and cascades to all their couples, events, invoices, and contracts."
        confirmLabel="Delete user"
        loadingLabel="Deleting…"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
