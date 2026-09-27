/**
 * Turn on two-factor sign-in: scan, confirm a code, save recovery codes.
 *
 * The steps and their rules live in {@link useTotpEnrolment}; this is the
 * modal around them. Closing before the recovery codes are on screen
 * removes the factor again, so 2FA is never left on without codes.
 *
 * @module app/(dashboard)/settings/two-factor-enrol-modal
 */
'use client';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Loading } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';

import { RecoveryCodesPanel } from './recovery-codes-panel';
import { TwoFactorScanStep } from './two-factor-scan-step';
import { useTotpEnrolment } from './use-totp-enrolment';

export interface TwoFactorEnrolModalProps {
  /** Called when the modal closes, enrolled or not. The card reloads. */
  onClose: () => void;
}

/** The enrolment modal. Mount it to open it. */
export function TwoFactorEnrolModal({ onClose }: TwoFactorEnrolModalProps) {
  const e = useTotpEnrolment();

  async function close() {
    if (await e.cancel()) onClose();
  }

  const footer = e.codes ? (
    <div className="flex justify-end">
      <Button type="button" onClick={onClose}>I have saved my codes</Button>
    </div>
  ) : e.verified && !e.busy ? (
    <div className="flex justify-end">
      <Button type="button" onClick={() => void e.issueCodes()}>Try again</Button>
    </div>
  ) : null;

  let body;
  if (e.codes) body = <RecoveryCodesPanel codes={e.codes} />;
  else if (e.verified) {
    body = e.busy ? (
      <Loading label="Creating your recovery codes" />
    ) : (
      <Callout tone="danger">
        <span role="alert">
          {e.error}
        </span>
      </Callout>
    );
  } else if (e.failed) {
    body = (
      <Callout tone="danger">
        <span role="alert">We could not start two-factor setup. Close this and try again.</span>
      </Callout>
    );
  } else if (!e.pending) body = <Loading />;
  else body = <TwoFactorScanStep pending={e.pending} busy={e.busy} error={e.error} onVerify={e.verify} />;

  return (
    <Modal isOpen onClose={() => void close()} title="Turn on two-factor sign-in" size="sm" footer={footer}>
      {body}
    </Modal>
  );
}
