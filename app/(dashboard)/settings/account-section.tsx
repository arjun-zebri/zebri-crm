/**
 * Settings → Account tab section.
 *
 * Three sub-features:
 *   1. **Change password** — posts to {@link changePasswordAction}
 *      (server action) which re-authenticates with the current
 *      password before updating, rate-limits per session, and
 *      validates against the shared {@link changePasswordSchema}.
 *   2. **Email preferences** — toggle which email categories the
 *      user wants (user-owned data, `user_metadata.email_preferences`).
 *   3. **Danger zone** — request account deletion. Currently
 *      delegates to the existing fake-delete behaviour (signs out);
 *      proper destructive deletion is tracked for Phase 13 (Admin /
 *      Shadow) since it has Stripe-subscription implications.
 *
 * Token-driven primitives only (Phase 1 hardening). The password
 * meter is shared with signup + update-password.
 *
 * @module app/(dashboard)/settings/account-section
 */
'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import type { ChangePasswordResult } from './account/action-state';
import { changePasswordAction } from './account/actions';

interface EmailPreferencesData {
  product_updates?: boolean;
  booking_reminders?: boolean;
  tips?: boolean;
}

export interface AccountSectionProps {
  emailPreferences?: EmailPreferencesData;
}

const emptyChangeState: ChangePasswordResult = {};

export function AccountSection({ emailPreferences: initialEmailPreferences }: AccountSectionProps) {
  return (
    <div className="max-w-2xl space-y-10">
      <ChangePasswordCard />
      {initialEmailPreferences ? (
        <EmailPreferencesCard initial={initialEmailPreferences} />
      ) : (
        <EmailPreferencesCard />
      )}
      <DangerZoneCard />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Change password
─────────────────────────────────────────────────────────────────── */

function ChangePasswordCard() {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(changePasswordAction, emptyChangeState);
  const [newPassword, setNewPassword] = useState('');
  // Track which state object we've already toasted by capturing the
  // identity in a ref — useEffect reads the previous identity and
  // updates it inside the same effect, which is the canonical
  // post-action notification pattern (no state setter cascade).
  const handledStateRef = useRef<typeof state | null>(null);

  useEffect(() => {
    if (!state.ok || !state.message || pending) return;
    if (handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast(state.message);
  }, [state, pending, toast]);

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-text">Change password</h2>
      <p className="mb-5 text-caption text-text-muted">Update your account password.</p>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <Input
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          {...(state.fieldErrors?.currentPassword ? { error: state.fieldErrors.currentPassword } : {})}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              help="Min. 10 chars. Include upper + lower + number + symbol."
              {...(state.fieldErrors?.password ? { error: state.fieldErrors.password } : {})}
            />
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            {...(state.fieldErrors?.confirmPassword ? { error: state.fieldErrors.confirmPassword } : {})}
          />
        </div>

        <Button type="submit" loading={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Email preferences
─────────────────────────────────────────────────────────────────── */

interface EmailPreferencesCardProps {
  initial?: EmailPreferencesData;
}

function EmailPreferencesCard({ initial }: EmailPreferencesCardProps) {
  const { toast } = useToast();
  const initialPrefs = {
    productUpdates: initial?.product_updates ?? true,
    bookingReminders: initial?.booking_reminders ?? true,
    tips: initial?.tips ?? false,
  };
  const [saved, setSaved] = useState(initialPrefs);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [saving, setSaving] = useState(false);

  const dirty =
    prefs.productUpdates !== saved.productUpdates ||
    prefs.bookingReminders !== saved.bookingReminders ||
    prefs.tips !== saved.tips;

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast('Unable to load user data.', 'error');
      setSaving(false);
      return;
    }
    const updated = {
      ...(user.user_metadata ?? {}),
      email_preferences: {
        product_updates: prefs.productUpdates,
        booking_reminders: prefs.bookingReminders,
        tips: prefs.tips,
      },
    };
    const { error } = await supabase.auth.updateUser({ data: updated });
    if (error) toast(error.message, 'error');
    else {
      toast('Email preferences saved.');
      setSaved({ ...prefs });
    }
    setSaving(false);
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium text-text">Email preferences</h3>
      <div className="mb-4 space-y-3">
        {(
          [
            ['productUpdates', 'Product updates and announcements'],
            ['bookingReminders', 'Booking reminders and event alerts'],
            ['tips', 'Tips and best practices'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-brand-fg"
            />
            <span className="text-sm text-text">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
        {dirty ? <span className="text-caption text-text-muted">Unsaved changes</span> : null}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Danger zone
   TODO: Phase 13 — implement true destructive deletion server-side
   (admin.deleteUser + Stripe subscription cancellation). For now the
   UI sign-out behaviour is preserved.
─────────────────────────────────────────────────────────────────── */

function DangerZoneCard() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <section className="border-t border-border pt-8">
      <h3 className="mb-1 text-sm font-medium text-danger">Danger zone</h3>
      <p className="mb-4 text-caption text-text-muted">
        Permanently delete your account and all associated data.
      </p>
      <Button variant="ghost" type="button" onClick={() => setShow(true)} className="border border-danger/40 text-danger hover:bg-danger/10">
        Delete account
      </Button>

      <Modal
        isOpen={show}
        onClose={() => {
          setShow(false);
          setConfirm('');
        }}
        title="Delete your account?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShow(false);
                setConfirm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={confirm !== 'DELETE'}
              loading={loading}
              onClick={doDelete}
            >
              {loading ? 'Deleting…' : 'Delete account'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-caption text-text-muted">
          This action is permanent and cannot be undone. All your data will be deleted.
        </p>
        <Input
          label='Type "DELETE" to confirm'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
        />
      </Modal>
    </section>
  );
}
