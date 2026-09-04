/**
 * The verification step's fields, as they appear inside the signing dialog.
 *
 * WHY THIS LIVES IN `components/` AND NOT BESIDE THE PAGE. Same reason as
 * {@link module:components/contracts/sign-form-fields}: the contract page is a
 * branded public surface and `scripts/check-public-surface-styling.mjs` bans
 * app tokens under `app/contract/**`, which is right for the DOCUMENT. This is
 * not the document. It is app chrome inside a dialog, and it sits directly
 * above the same Type/Draw controls the signer sees a moment later, so it has
 * to be the same size as those.
 *
 * Hand-rolled from branded inline styles it was not: `py-2.5` padding made a
 * ~42px input and button beside the dialog's 32px controls, and Resend carried
 * the same weight as Verify. The primitives supply the single control height
 * and the three-size type scale for free.
 *
 * @module components/contracts/otp-gate-fields
 */
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface OtpGateFieldsProps {
  /** Status line: sending, sent-to address, or a bare prompt. */
  status: string;
  code: string;
  onCodeChange: (next: string) => void;
  onVerify: () => void;
  onResend: () => void;
  /** Verify is in flight. */
  verifying: boolean;
  /** Too many wrong attempts: the code field and Verify are dead. */
  locked: boolean;
  /** Seconds until Resend re-enables. 0 means it is available now. */
  cooldown: number;
  /** Error text, or null. */
  message: string | null;
}

export function OtpGateFields({
  status,
  code,
  onCodeChange,
  onVerify,
  onResend,
  verifying,
  locked,
  cooldown,
  message,
}: OtpGateFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-body font-medium text-text">Verify it&apos;s you</p>
        <p className="mt-0.5 text-body text-text-muted">{status}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* One field, not six boxes. `tracking-widest` sits on the wrapper and
            inherits: letter-spacing is not something `className` can reach on
            the input itself, and it is the only thing that makes six digits
            legible as a code rather than a number. */}
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          aria-label="6-digit code"
          disabled={locked}
          className="w-28 tracking-widest"
        />
        <Button
          onClick={onVerify}
          disabled={code.length !== 6 || locked}
          loading={verifying}
        >
          Verify
        </Button>
        {/* Ghost, because resending is the way out of a problem rather than the
            thing being asked for: it must not compete with Verify. */}
        <Button variant="ghost" onClick={onResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${String(cooldown)}s` : 'Resend code'}
        </Button>
      </div>

      {message ? (
        <p role="alert" className="text-body text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
