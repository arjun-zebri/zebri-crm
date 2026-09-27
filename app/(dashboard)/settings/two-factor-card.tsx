/**
 * Settings, Account: two-factor sign-in (Phase 4, Task 23).
 *
 * Opt-in per MC. Off: one button that opens {@link TwoFactorEnrolModal}.
 * On: when it was turned on, how many recovery codes are left, and two
 * actions, new codes and turn off, each behind a confirmation because
 * both make something stop working (old codes, or the second factor).
 *
 * @module app/(dashboard)/settings/two-factor-card
 */
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { RECOVERY_CODE_COUNT } from '@/lib/auth/mfa';

import { issueRecoveryCodesAction, turnOffTwoFactorAction } from './account/two-factor-actions';
import { RecoveryCodesPanel } from './recovery-codes-panel';
import { TwoFactorEnrolModal } from './two-factor-enrol-modal';
import { useTwoFactor } from './use-two-factor';

type Confirming = 'new-codes' | 'turn-off' | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The two-factor sign-in card. */
export function TwoFactorCard() {
  const { toast } = useToast();
  const { state, reload } = useTwoFactor();
  const [enrolling, setEnrolling] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function confirm() {
    setBusy(true);
    if (confirming === 'new-codes') {
      const result = await issueRecoveryCodesAction();
      if (result.ok) setCodes(result.codes);
      else toast(result.error, 'error');
    } else {
      const result = await turnOffTwoFactorAction();
      toast(result.ok ? 'Two-factor sign-in is off.' : result.error, result.ok ? undefined : 'error');
    }
    setBusy(false);
    setConfirming(null);
    reload();
  }

  return (
    <section className="border-t border-border pt-8">
      <h3 className="mb-1 text-body font-medium text-text">Two-factor sign-in</h3>
      <p className="mb-4 text-body text-text-muted">
        Ask for a 6-digit code from an authenticator app each time you sign in, as well as your
        password.
      </p>

      {state.status === 'loading' ? (
        <Loading variant="inline" label="Checking two-factor sign-in" />
      ) : state.status === 'error' ? (
        <ErrorState title="Could not check two-factor sign-in" onRetry={reload} />
      ) : state.factor ? (
        <div className="space-y-4">
          {state.remaining === 0 ? (
            // Backstop for 2FA left on with no codes (a closed tab during
            // setup, or every code spent): one lost phone from lock-out.
            <Callout tone="warning">
              You have no recovery codes left. If you lose your phone you will not be able to sign
              in. Create new recovery codes now and keep them somewhere safe.
            </Callout>
          ) : null}
          <p className="text-body text-text">
            On since {formatDate(state.factor.createdAt)}.
            {state.remaining !== null
              ? ` ${state.remaining} of ${RECOVERY_CODE_COUNT} recovery codes left.`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={state.remaining === 0 ? 'primary' : 'outline'}
              onClick={() => setConfirming('new-codes')}
            >
              New recovery codes
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming('turn-off')}>
              Turn off
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={() => setEnrolling(true)}>
          Turn on two-factor sign-in
        </Button>
      )}

      {enrolling ? (
        <TwoFactorEnrolModal
          onClose={() => {
            setEnrolling(false);
            reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'turn-off' ? 'Turn off two-factor sign-in?' : 'Replace your recovery codes?'}
        description={
          confirming === 'turn-off'
            ? 'Signing in will need only your password again, and your recovery codes stop working.'
            : 'You get ten new codes and every code you saved before stops working.'
        }
        tone={confirming === 'turn-off' ? 'danger' : 'primary'}
        confirmLabel={confirming === 'turn-off' ? 'Turn off' : 'Create new codes'}
        loadingLabel={confirming === 'turn-off' ? 'Turning off...' : 'Creating...'}
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(null)}
      />

      <Modal
        isOpen={codes !== null}
        onClose={() => setCodes(null)}
        title="Your new recovery codes"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={() => setCodes(null)}>I have saved my codes</Button>
          </div>
        }
      >
        {codes ? <RecoveryCodesPanel codes={codes} /> : null}
      </Modal>
    </section>
  );
}
