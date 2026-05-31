'use client';

import { useState, useTransition } from 'react';
import { UserCog } from 'lucide-react';

import { deleteUser, enterShadow, sendPasswordReset } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import type { AdminUser } from '@/lib/admin/admin-analytics';

/**
 * Account-level admin levers — send password reset (recovery link
 * copied to clipboard), enter shadow mode as the target user, and
 * delete the account.
 *
 * Delete is destructive: it cancels the Stripe subscription, removes
 * the Stripe customer, and then deletes the auth.users row (cascade
 * removes couples / events / etc). Confirmed via dialog; logged in
 * admin_audit_log + fires a `admin_user_deleted` Slack alert.
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
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
        Account actions
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleEnterShadow} variant="secondary" size="sm">
          <UserCog size={14} strokeWidth={1.5} />
          Enter shadow mode
        </Button>
        <Button onClick={handlePasswordReset} variant="secondary" size="sm">
          Send password reset
        </Button>
        <Button onClick={() => setConfirmDelete(true)} variant="danger" size="sm">
          Delete user
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user.email}?`}
        description="This permanently removes the user and cascades to all their couples, events, invoices, and contracts."
        confirmLabel="Delete user"
        loadingLabel="Deleting…"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
