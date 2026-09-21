'use client'

import type { Session } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

/**
 * POST a file to a path in the `branding` Storage bucket via raw `fetch`
 * (bypassing supabase-js) so a failure response body is visible. supabase-js
 * throws away non-JSON response bodies and reports a generic "HTTP 400
 * error", which is useless when Cloudflare/nginx in front of storage rejects
 * the request with an HTML error page. Shared by every branding-bucket
 * uploader ({@link uploadBrandAsset}, {@link uploadBlockImage}) so the
 * request/error-handling code exists exactly once.
 *
 * @param session: The current auth session (for the bearer token + user id).
 * @param path: Storage path under the `branding` bucket, e.g. `${userId}/logo`.
 * @param file: The file to upload.
 * @param onError: Called with a user-facing message when the upload fails.
 * @throws Error when the response is not ok.
 */
async function putBrandingObject(
  session: Session,
  path: string,
  file: File,
  onError?: (msg: string) => void
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/branding/${path}`
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  const body = await file.arrayBuffer()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey,
      'x-upsert': 'true',
      'Content-Type': file.type || 'application/octet-stream',
      'Cache-Control': 'max-age=3600',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[branding upload failed]', {
      path,
      size: file.size,
      type: file.type,
      fileName: file.name,
      status: res.status,
      respContentType: res.headers.get('content-type'),
      respBodyPreview: text.slice(0, 800),
      tokenLength: session.access_token.length,
      apikeyLength: apikey.length,
    })
    const msg = `Upload failed (${res.status}): ${text.slice(0, 100) || res.statusText}`
    onError?.(msg)
    throw new Error(`Upload failed: ${res.status}`)
  }
}

/**
 * Upload a brand asset (logo, favicon, header) to Supabase Storage.
 *
 * Handles size validation, raw fetch (for better error details), and returns a cacheable public URL.
 * Used by both the branding editor and onboarding wizard.
 *
 * @param file: The file to upload.
 * @param kind: Asset type: 'logo', 'favicon', or 'header'.
 * @returns Public URL with cache-buster query param.
 * @throws Error if upload fails (including size validation).
 */
export async function uploadBrandAsset(
  file: File,
  kind: 'logo' | 'favicon' | 'header',
  options?: { onError?: (msg: string) => void }
): Promise<string> {
  // Validate size per asset type.
  const maxSizes = {
    logo: 2 * 1024 * 1024,
    favicon: 256 * 1024,
    header: 4 * 1024 * 1024,
  }
  const maxSize = maxSizes[kind]
  if (file.size > maxSize) {
    const msg = `${kind} must be under ${maxSize / 1024 / 1024}MB`
    options?.onError?.(msg)
    throw new Error('size')
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const userId = session.user.id
  const path = `${userId}/${kind}`
  await putBrandingObject(session, path, file, options?.onError)

  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

/**
 * Upload a static image used inside a proposal block (hero background,
 * gallery tile, testimonial portrait, about-me portrait) to Supabase
 * Storage. Same shape as {@link uploadBrandAsset} but keyed by the caller's
 * own `key` (e.g. `hero-${block.id}`) rather than a fixed asset kind, and
 * capped at 4MB, matching the existing per-image-block cap.
 *
 * @param file: The file to upload.
 * @param key: Caller-chosen storage key, unique per image within the account.
 * @returns Public URL with cache-buster query param.
 * @throws Error if upload fails (including size validation).
 */
export async function uploadBlockImage(
  file: File,
  key: string,
  options?: { onError?: (msg: string) => void }
): Promise<string> {
  const maxSize = 4 * 1024 * 1024
  if (file.size > maxSize) {
    const msg = `Image must be under ${maxSize / 1024 / 1024}MB`
    options?.onError?.(msg)
    throw new Error('size')
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const userId = session.user.id
  const path = `${userId}/${key}`
  await putBrandingObject(session, path, file, options?.onError)

  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
