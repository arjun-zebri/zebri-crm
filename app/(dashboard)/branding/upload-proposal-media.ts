'use client'

import { createClient } from '@/lib/supabase/client'

/** Cap on an uploaded proposal video, matching the storage bucket's own limit. */
export const PROPOSAL_MEDIA_MAX_BYTES = 50 * 1024 * 1024

/** Video MIME types the hero/video blocks accept for an uploaded (not embedded) source. */
export const PROPOSAL_MEDIA_TYPES = ['video/mp4', 'video/webm'] as const

/**
 * Upload a proposal video (hero background or video block) to the
 * `proposal-media` Storage bucket, reporting upload progress along the way.
 *
 * Uses `XMLHttpRequest` rather than `fetch` because `fetch` has no upload
 * progress event: a multi-MB video upload with no feedback reads as a
 * frozen editor. Validates type and size before opening any request, so a
 * bad file never starts a doomed upload.
 *
 * @param file: The video file to upload.
 * @param key: Caller-chosen storage key, unique per video within the account
 *   (e.g. `hero-${block.id}.mp4`).
 * @param options.onProgress: Called with 0-100 as the upload advances.
 * @param options.onError: Called with a user-facing message on validation or upload failure.
 * @returns Public URL with a cache-buster query param.
 * @throws Error if validation fails, the caller is not signed in, or the upload fails.
 */
export async function uploadProposalMedia(
  file: File,
  key: string,
  // Both fields are typed `| undefined` (not just `?:`) so a caller building
  // this object from another optional value (as `branding-editor.tsx`'s
  // `uploadVideoCb` does with its own optional `onProgress` param) type-checks
  // under `exactOptionalPropertyTypes`.
  options?: { onProgress?: ((pct: number) => void) | undefined; onError?: ((msg: string) => void) | undefined }
): Promise<string> {
  if (!PROPOSAL_MEDIA_TYPES.includes(file.type as (typeof PROPOSAL_MEDIA_TYPES)[number])) {
    const msg = 'Please choose an MP4 or WebM video'
    options?.onError?.(msg)
    throw new Error('type')
  }
  if (file.size > PROPOSAL_MEDIA_MAX_BYTES) {
    const msg = `Video must be under ${PROPOSAL_MEDIA_MAX_BYTES / 1024 / 1024}MB`
    options?.onError?.(msg)
    throw new Error('size')
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const userId = session.user.id
  const path = `${userId}/${key}`
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/proposal-media/${path}`
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', apikey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('Cache-Control', 'max-age=3600')
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      options?.onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      console.error('[proposal media upload failed]', {
        key,
        size: file.size,
        type: file.type,
        fileName: file.name,
        status: xhr.status,
        respBodyPreview: xhr.responseText.slice(0, 800),
      })
      const msg = `Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 100) || xhr.statusText}`
      options?.onError?.(msg)
      reject(new Error(`Upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => {
      const msg = 'Upload failed'
      options?.onError?.(msg)
      reject(new Error('Upload failed: network error'))
    }
    xhr.send(file)
  })

  const { data } = supabase.storage.from('proposal-media').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
