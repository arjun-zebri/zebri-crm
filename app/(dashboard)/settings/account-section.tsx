/**
 * Settings → Account tab section.
 *
 * Three sub-features:
 *   1. **Change password**: posts to {@link changePasswordAction}
 *      (server action) which re-authenticates with the current
 *      password before updating, rate-limits per session, and
 *      validates against the shared {@link changePasswordSchema}.
 *   2. **Email preferences**: toggle which email categories the
 *      user wants (user-owned data, `user_metadata.email_preferences`).
 *   3. **Danger zone**: request account deletion. Currently
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
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import type { ChangePasswordResult } from './account/action-state';
import { changePasswordAction } from './account/actions';
import { AutoSaveStatus, type SaveState } from './auto-save-status';

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
    <div className="space-y-10">
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
  // Rotate this key on success to force a fresh, empty form. Cheaper +
  // more deterministic than manually resetting individual inputs (the
  // uncontrolled fields wouldn't clear on `formRef.reset()` because
  // React 19 form actions re-apply React-owned state).
  const [formKey, setFormKey] = useState(0);
  // Track which state object we've already toasted by capturing the
  // identity in a ref, useEffect reads the previous identity and
  // updates it inside the same effect, which is the canonical
  // post-action notification pattern (no state setter cascade).
  const handledStateRef = useRef<typeof state | null>(null);

  useEffect(() => {
    if (!state.ok || !state.message || pending) return;
    if (handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast(state.message);
    // Defer the form-reset state updates so React doesn't cascade
    // them into another effect pass in the same commit.
    startTransition(() => {
      setNewPassword('');
      setFormKey((k) => k + 1);
    });
  }, [state, pending, toast]);

  return (
    <section>
      <h2 className="mb-1 text-section font-semibold text-text">Change password</h2>
      <p className="mb-5 text-caption text-text-muted">Update your account password.</p>

      {state.error && !state.fieldErrors ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger/40 bg-danger/10 p-3 text-caption text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form key={formKey} action={formAction} className="space-y-4">
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
  const [prefs, setPrefs] = useState(initialPrefs);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Persist the given preference set immediately. The toggled value is
  // passed in (not read from state) so the save reflects the click that
  // triggered it rather than the pre-toggle closure.
  async function save(next: typeof prefs) {
    setSaveState('saving');
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast('Unable to load user data.', 'error');
      setSaveState('error');
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        email_preferences: {
          product_updates: next.productUpdates,
          booking_reminders: next.bookingReminders,
          tips: next.tips,
        },
      },
    });
    setSaveState(error ? 'error' : 'saved');
    if (error) toast(error.message, 'error');
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-body font-medium text-text">Email preferences</h3>
        <AutoSaveStatus state={saveState} />
      </div>
      <div className="space-y-3">
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
              onChange={(e) => {
                const next = { ...prefs, [key]: e.target.checked };
                setPrefs(next);
                void save(next);
              }}
              className="h-4 w-4 rounded-control border-border accent-brand-fg"
            />
            <span className="text-body text-text">{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Danger zone
   TODO: Phase 13: implement true destructive deletion server-side
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
      <h3 className="mb-1 text-body font-medium text-danger">Danger zone</h3>
      <p className="mb-4 text-caption text-text-muted">
        Permanently delete your account and all associated data.
      </p>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-control border border-danger/40 px-4 text-body font-medium text-danger transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Delete account
      </button>

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
