/**
 * The Compose email modal's preview: the draft, as the couple receives it.
 *
 * Rendered on the server by `previewComposeEmailAction`, through the
 * send's own chain, so the branding, signature, preheader and legal
 * footer here are the real ones. A workflow template belongs to no
 * couple, so the draft is rendered for the MC's own most recent couple,
 * or a sample couple when they have none, and the caption says which.
 *
 * @module app/(dashboard)/workflows/[id]/compose-email-preview
 */
'use client'

import type { JSONContent } from '@tiptap/react'

import { toPlainJSON } from '@/lib/utils'

import { previewComposeEmailAction } from '../preview-actions'
import { PreviewFailed } from '../preview-failed'
import { useServerPreview } from '../use-server-preview'

import { EmailPreview } from './email-preview'

export interface ComposeEmailPreviewProps {
  subject: string
  content: JSONContent
  /** The draft's `wrap` flag; undefined means the default (wrapped). */
  wrap?: boolean | undefined
}

/** The draft email, rendered. See {@link ComposeEmailPreviewProps}. */
export function ComposeEmailPreview({ subject, content, wrap }: ComposeEmailPreviewProps) {
  // TipTap hands back null-prototype attrs, which the server-action
  // boundary silently drops, turning every variable into `{{null}}`.
  // Normalised once here, and the same value keys the refetch.
  const plain = toPlainJSON(content) as Record<string, unknown>
  const key = JSON.stringify([subject, plain, wrap])

  const preview = useServerPreview(key, () =>
    previewComposeEmailAction({
      subject,
      content: plain,
      ...(wrap !== undefined ? { wrap } : {}),
    }),
  )
  const { data, current, error } = preview

  // Nothing rendered yet and the render failed: an error with a way out.
  if (error && !data) return <PreviewFailed error={error} onRetry={preview.retry} />

  // Only a render of the draft on screen may say whose inbox it shows.
  // An older one stays up, dimmed, under "Updating", or under the error
  // with Try again when the refresh failed: a rate limit that never
  // clears by itself must not leave the MC with no way to force one.
  const caption = error
    ? 'The last preview, from before your latest changes.'
    : !current
      ? 'Updating the preview.'
      : data?.couple.sample
        ? `Shown with a sample couple, ${data.couple.name}. Links are inactive here.`
        : `Shown as ${data?.couple.name ?? 'your couple'} would receive it. Links are inactive here.`

  return (
    <div className="space-y-2">
      {error ? <PreviewFailed error={error} onRetry={preview.retry} /> : null}
      <EmailPreview
        ready={data !== null}
        pending={!current}
        subject={data?.subject || 'No subject yet'}
        html={data?.html ?? ''}
        frameTitle="Email preview"
        caption={caption}
        height="h-96"
      />
      {data && current && data.unresolved.length > 0 ? (
        <p className="text-body text-text-muted">
          {data.unresolved.join(', ')} {data.unresolved.length === 1 ? 'is' : 'are'} empty for{' '}
          {data.couple.name}. A couple missing a detail is held until you fill it in.
        </p>
      ) : null}
      {/* Not "empty for" the couple: no couple has a value for a
          variable Zebri does not know (live check B7). */}
      {data && current && (data.unknown ?? []).length > 0 ? (
        <p className="break-words text-body text-danger">
          {(data.unknown ?? []).map((path) => `{{${path}}}`).join(', ')}{' '}
          {(data.unknown ?? []).length === 1 ? 'is not a variable' : 'are not variables'} Zebri
          knows, so every couple is held on it. Remove it or pick a variable from the list.
        </p>
      ) : null}
    </div>
  )
}
