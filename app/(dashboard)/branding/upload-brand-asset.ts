'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Upload a brand asset (logo, favicon, header) to Supabase Storage.
 *
 * Handles size validation, raw fetch (for better error details), and returns a cacheable public URL.
 * Used by both the branding editor and onboarding wizard.
 *
 * @param file — The file to upload.
 * @param kind — Asset type: 'logo', 'favicon', or 'header'.
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

  // Manual fetch (bypassing supabase-js) so we see the actual response body
  // when Cloudflare/nginx in front of storage rejects with HTML. supabase-js
  // throws away non-JSON response bodies and reports a generic "HTTP 400 error".
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
      kind,
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
    options?.onError?.(msg)
    throw new Error(`Upload failed: ${res.status}`)
  }

  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
