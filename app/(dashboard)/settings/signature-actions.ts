/**
 * Server action for the MC's drawn signature (Settings → Personal info).
 *
 * The MC draws their signature once and it is stamped on every contract they
 * send. Persisted to `user_public_settings`, NOT `user_metadata`: the latter is
 * serialised into the JWT and is user-writable, and `_user_branding` reads it
 * onto every public surface, so a ~100KB image there would both bloat every
 * access token and leak onto documents that have nothing to do with signing.
 *
 * @module app/(dashboard)/settings/signature-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import {
  isValidSignatureDataUrl,
  SIGNATURE_MAX_BYTES,
} from '@/lib/contracts/signature-image';
import { createClient } from '@/lib/supabase/server';

/** Generic tagged action result, matching the other settings actions. */
export type SignatureActionResult = { ok: true } | { ok: false; error: string };

const signatureSchema = z.object({
  /**
   * The drawn signature as a base64 PNG data URL, or null to clear it. Same
   * validation as the public signing route, since both end up in a column with
   * the same CHECK constraint.
   */
  signature: z
    .string()
    .max(SIGNATURE_MAX_BYTES, 'Signature image is too large')
    .refine(isValidSignatureDataUrl, 'Signature must be a PNG data URL')
    .nullable(),
});

/**
 * Save (or clear) the MC's drawn signature.
 *
 * Changing it never alters an already-sent contract: the image is snapshotted
 * onto `contract_signers` at send time, so the document keeps the signature it
 * was executed with.
 *
 * @param input - The signature data URL, or null to remove it.
 */
export async function saveSignatureImageAction(
  input: { signature: string | null },
): Promise<SignatureActionResult> {
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'That signature could not be saved.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Session expired. Please log in again.' };

  const { error } = await supabase
    .from('user_public_settings')
    .upsert(
      { user_id: user.id, mc_signature_image: parsed.data.signature },
      { onConflict: 'user_id' },
    );

  if (error) {
    logger.error('[settings/signature] save failed', error, { userId: user.id });
    return { ok: false, error: 'Could not save your signature. Please try again.' };
  }

  return { ok: true };
}
