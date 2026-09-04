/**
 * The "verify it's you" step shown in place of the sign form when a contract
 * requires an emailed code.
 *
 * State and requests only. The markup lives in
 * `components/contracts/otp-gate-fields`, because it renders inside the app's
 * signing dialog and has to match the primitives there rather than the branded
 * document behind it. Same split, for the same reason, as the sign form.
 *
 * ONE input, not six boxes. Six-box code inputs are ninety lines of focus and
 * paste plumbing to reproduce what a single `inputMode="numeric"` field with
 * `autocomplete="one-time-code"` gives for free, including iOS surfacing the
 * code from Mail above the keyboard, and paste working without special
 * handling. On a phone, where most couples sign, the single field is also the
 * one that behaves.
 *
 * @module app/contract/[token]/_components/contract-otp-gate
 */
import { useEffect, useRef, useState } from 'react';

import { OtpGateFields } from '@/components/contracts/otp-gate-fields';

export interface ContractOtpGateProps {
  token: string;
  /** Called once the code is accepted, so the page can reload and unlock. */
  onVerified: () => void;
}

type GateState = 'requesting' | 'sent' | 'verifying' | 'error' | 'locked';

export function ContractOtpGate({ token, onVerified }: ContractOtpGateProps) {
  const [state, setState] = useState<GateState>('requesting');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // One request per mount. React strict mode double-invokes effects in dev,
  // and the server's per-token limiter is the real control, but there is no
  // reason to fire twice.
  const requested = useRef(false);

  const request = async () => {
    const res = await fetch('/api/contract/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      sent_to?: string | null;
      retry_after?: number;
      error?: string;
    };
    if (!res.ok) {
      setState('error');
      setMessage(
        data.error === 'too_many_requests'
          ? 'Please wait a moment before asking for another code.'
          : data.error === 'not_found'
            ? // `issue_signer_otp` only issues for a contract that has been
              // sent, so a draft (or a dead link) lands here. Retrying never
              // helps, and saying "we could not send a code" points the
              // signer at their inbox instead of at the real problem.
              'This signing link is not active yet. Please check with the sender.'
            : 'We could not send a code. Please try again shortly.',
      );
      return;
    }
    setSentTo(data.sent_to ?? null);
    setCooldown(data.retry_after ?? 60);
    setState('sent');
    setMessage(null);
  };

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void request();
    // Intentionally mount-only: the code is requested once when the gate
    // appears, and afterwards only by the explicit Resend control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = async () => {
    if (code.length !== 6) return;
    setState('verifying');
    const res = await fetch('/api/contract/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, code }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      attempts_remaining?: number;
    };
    if (res.ok && data.ok) {
      onVerified();
      return;
    }
    if (data.error === 'locked') {
      setState('locked');
      setMessage('Too many attempts. Request a new code in a few minutes.');
      return;
    }
    setState('error');
    setMessage(
      data.error === 'code_expired'
        ? 'That code has expired. Ask for a new one.'
        : data.error === 'no_code'
          ? 'Ask for a code to get started.'
          : `That code is not right.${
              data.attempts_remaining
                ? ` ${String(data.attempts_remaining)} ${data.attempts_remaining === 1 ? 'try' : 'tries'} left.`
                : ''
            }`,
    );
  };

  return (
    <OtpGateFields
      status={
        state === 'requesting'
          ? 'Sending you a code…'
          : sentTo
            ? `We sent a 6-digit code to ${sentTo}.`
            : 'Enter the 6-digit code we sent you.'
      }
      code={code}
      onCodeChange={setCode}
      onVerify={() => void verify()}
      onResend={() => void request()}
      verifying={state === 'verifying'}
      locked={state === 'locked'}
      cooldown={cooldown}
      message={message}
    />
  );
}
