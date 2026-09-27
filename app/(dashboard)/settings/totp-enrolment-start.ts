/**
 * Starting a TOTP enrolment in the browser, for {@link useTotpEnrolment}.
 *
 * @module app/(dashboard)/settings/totp-enrolment-start
 */
'use client';

import { createClient } from '@/lib/supabase/client';

/** An enrolment waiting for its first code. */
export interface PendingFactor {
  factorId: string;
  /** `data:` URL of the QR code, safe for next/image. */
  qr: string;
  /** The base32 secret, for typing in by hand. */
  secret: string;
}

/**
 * supabase-js hands the QR back as `data:image/svg+xml;utf-8,<raw svg>`,
 * raw markup ending in a newline, which next/image rejects outright
 * ("cannot end with a space or control character"). Re-encode the SVG
 * body so the data URL is well formed.
 */
function encodeQr(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml;[^,]*,/, '').trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Start a fresh TOTP enrolment, clearing any abandoned unverified one first. */
export async function startEnrolment(): Promise<PendingFactor> {
  const supabase = createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  // No friendly name: Supabase refuses a second factor with the same
  // non-empty name, and the name is never shown to the MC anyway.
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return { factorId: data.id, qr: encodeQr(data.totp.qr_code), secret: data.totp.secret };
}
