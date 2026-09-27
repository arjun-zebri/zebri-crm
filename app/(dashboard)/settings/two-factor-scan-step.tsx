/**
 * The scan-and-confirm step of turning on two-factor sign-in: QR code,
 * the key for typing in by hand, and the first 6-digit code.
 *
 * @module app/(dashboard)/settings/two-factor-scan-step
 */
'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { PendingFactor } from './use-totp-enrolment';

export interface TwoFactorScanStepProps {
  pending: PendingFactor;
  busy: boolean;
  error: string | null;
  /** Check the typed code. */
  onVerify: (code: string) => Promise<void>;
}

/** QR, key and first code. See {@link TwoFactorScanStepProps}. */
export function TwoFactorScanStep({ pending, busy, error, onVerify }: TwoFactorScanStepProps) {
  const [code, setCode] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onVerify(code);
    setCode('');
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
      <p className="text-body text-text-muted">
        Scan this with an authenticator app such as Google Authenticator or 1Password, then enter
        the 6-digit code it shows.
      </p>
      {/* bg-surface is white in every theme today; the QR's own
          background is transparent, so it needs a light surface to scan. */}
      <div className="flex justify-center rounded-control border border-border bg-surface p-3">
        <Image src={pending.qr} alt="QR code for your authenticator app" width={176} height={176} unoptimized />
      </div>
      <p className="break-all text-body text-text-muted">
        Can&apos;t scan? Enter this key instead:{' '}
        <span className="font-mono text-text">{pending.secret}</span>
      </p>
      <Input
        label="Authentication code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        {...(error ? { error } : {})}
      />
      <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">
        Verify and turn on
      </Button>
    </form>
  );
}
