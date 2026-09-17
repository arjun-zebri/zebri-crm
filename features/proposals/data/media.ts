'use client'

/**
 * Client-side upload of proposal media (image / audio / video / hero
 * background) to the `proposal-media` Storage bucket, for the insert
 * palette's image/audio items and the node bars that will follow (Tasks
 * 9-11). Mirrors `app/(dashboard)/branding/upload-proposal-media.ts`'s
 * raw-`XMLHttpRequest` pattern (`fetch` has no upload-progress event, and
 * a multi-MB upload with no feedback reads as a frozen editor) as a
 * standalone module this feature owns outright: `features/proposals/`
 * may not import from `app/(dashboard)/branding/` for this (see the
 * module boundary note in `features/proposals/index.ts`), so the ~90
 * lines are duplicated rather than shared.
 *
 * @module features/proposals/data/media
 */
import { createClient } from '@/lib/supabase/client'

/** The kind of proposal media being uploaded; also the storage sub-folder (`${userId}/${kind}/...`). */
export type MediaKind = 'image' | 'audio' | 'video' | 'background'

/** One kind's accepted MIME types and byte cap. */
export interface MediaLimit {
  maxBytes: number
  types: readonly string[]
}

/**
 * Per-kind caps, shared with the bars' error copy (Tasks 9-11): image
 * 10MB, audio 25MB, video 50MB. `background` (the hero section's cover)
 * is a video upload too, so it takes the same cap and types as `video`.
 */
export const MEDIA_LIMITS: Record<MediaKind, MediaLimit> = {
  image: { maxBytes: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  audio: { maxBytes: 25 * 1024 * 1024, types: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav'] },
  video: { maxBytes: 50 * 1024 * 1024, types: ['video/mp4', 'video/webm'] },
  background: { maxBytes: 50 * 1024 * 1024, types: ['video/mp4', 'video/webm'] },
}

/**
 * Canonical storage-key extension for every MIME type `MEDIA_LIMITS`
 * accepts. Explicit rather than derived from the MIME subtype: a bare
 * subtype gives `audio/mpeg` -> `.mpeg` and `image/jpeg` -> `.jpeg`,
 * neither the conventional file extension (`.mp3`, `.jpg`).
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

/** A storage-key-safe file extension for `file`: the canonical extension for its MIME type, or, for a type outside `MIME_EXTENSIONS`, whatever extension its own name already carries. */
function extensionFor(file: File): string {
  const known = MIME_EXTENSIONS[file.type]
  if (known) return known
  const dot = file.name.lastIndexOf('.')
  return dot === -1 ? 'bin' : file.name.slice(dot + 1)
}

/**
 * Upload one proposal media file to the `proposal-media` bucket, at
 * `${userId}/${kind}/${uuid}.${ext}`, reporting progress along the way.
 *
 * Validates type and size against `MEDIA_LIMITS[kind]` before opening any
 * request, so a bad file never starts a doomed upload.
 *
 * @throws Error with a user-facing message when validation, the session
 *   check, or the upload itself fails.
 * @returns Public URL with a cache-buster query param.
 */
export async function uploadProposalMediaFile(
  file: File,
  kind: MediaKind,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const limit = MEDIA_LIMITS[kind]
  if (!limit.types.includes(file.type)) {
    throw new Error(`Please choose a ${kind} file of type ${limit.types.join(', ')}`)
  }
  if (file.size > limit.maxBytes) {
    throw new Error(`File must be under ${Math.round(limit.maxBytes / 1024 / 1024)}MB`)
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const userId = session.user.id
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${extensionFor(file)}`
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
      onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 100) || xhr.statusText}`))
    }
    xhr.onerror = () => reject(new Error('Upload failed: network error'))
    xhr.send(file)
  })

  const { data } = supabase.storage.from('proposal-media').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
