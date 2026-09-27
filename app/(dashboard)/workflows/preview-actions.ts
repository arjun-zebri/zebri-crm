/**
 * Server action behind the builder's Compose email preview.
 *
 * The builder edits a workflow template, which belongs to no couple, and
 * the draft in the composer is not saved yet. So this previews the draft
 * itself, rendered server-side through the send's own chain
 * (`lib/email/send-email-render` via `renderEmailPreview`), against the
 * MC's first real couple or a labelled sample. Rendering in the browser
 * instead would mean a second copy of that chain, which is the drift
 * this preview exists to remove.
 *
 * Read-only by construction: nothing is sent, logged to `couple_emails`,
 * counted against the send cap, or minted (the unsubscribe link is a
 * placeholder, see `PREVIEW_UNSUBSCRIBE_URL`).
 *
 * @module app/(dashboard)/workflows/preview-actions
 */
'use server'

import { z } from 'zod'

import { inMemoryLimiter } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { buildComposePreviewContext } from '@/lib/workflows/preview-context'
import { loadTemplateParts, renderEmailPreview } from '@/lib/workflows/review'

import type { ActionResult } from './instance-actions'

/** What the Compose email modal shows. */
export interface ComposePreview {
  /**
   * The subject as shown: a gap reads `[Venue name]`, marked the way the
   * step detail preview marks it, rather than vanishing (live check B8).
   */
  subject: string
  /** The whole email as the send renders it. */
  html: string
  /** Variables Zebri knows that this couple cannot fill, by readable label. */
  unresolved: string[]
  /**
   * Variables Zebri does not know at all, by path (live check B7). No
   * couple can fill them, so they are worded apart from `unresolved`.
   */
  unknown: string[]
  /** Who it is rendered for: the MC's couple, or the sample. */
  couple: { name: string; sample: boolean }
}

/**
 * A draft body is a TipTap doc. Bounded so a pasted novel cannot make
 * each keystroke's preview a large render.
 */
const MAX_DOC_CHARS = 200_000

const composePreviewSchema = z.object({
  subject: z.string().max(300),
  content: z
    .record(z.string(), z.unknown())
    .nullable()
    .refine((doc) => doc === null || JSON.stringify(doc).length <= MAX_DOC_CHARS, {
      message: 'The email is too long to preview.',
    }),
  /** The legacy plain-text body, for a step saved before the composer. */
  body: z.string().max(20_000).optional(),
  /** A saved template the draft still points at (pre-composer steps). */
  templateId: z.string().uuid().optional(),
  wrap: z.boolean().optional(),
})

// The composer re-previews as the MC types (debounced), and each render
// reads the MC's auth record. A generous cap stops a stuck loop, not a
// person.
const previewLimiter = inMemoryLimiter({ windowMs: 60_000, max: 120 })

/**
 * Render the Compose email modal's draft as the couple would receive it.
 *
 * @param input - The draft's subject and body. The body must already be
 *   run through `toPlainJSON`: TipTap's null-prototype attrs are dropped
 *   by the server-action boundary, which corrupts mention ids.
 */
export async function previewComposeEmailAction(
  input: z.infer<typeof composePreviewSchema>,
): Promise<ActionResult<ComposePreview>> {
  const parsed = composePreviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid draft.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { allowed } = await previewLimiter.check(user.id)
  if (!allowed) return { ok: false, error: 'Too many previews. Try again in a minute.' }

  // The MC's own client picks the couple, so RLS is the ownership check:
  // another tenant's couple can never be read here.
  const { data: couple } = await supabase
    .from('couples')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Same client for a template the draft still names: someone else's
  // reads as missing.
  const draft = parsed.data
  let template = null
  if (draft.templateId && !draft.content) {
    template = await loadTemplateParts(supabase, draft.templateId)
    if (!template) return { ok: false, error: 'The saved template could not be found.' }
  }

  const ctx = await buildComposePreviewContext(createAdminClient(), user.id, couple?.id ?? null)
  const preview = renderEmailPreview(
    {
      subject: draft.subject,
      ...(draft.content ? { content: draft.content } : {}),
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.wrap !== undefined ? { wrap: draft.wrap } : {}),
    },
    template,
    ctx,
  )

  return {
    ok: true,
    data: {
      subject: preview.subjectPreview ?? preview.subject ?? '',
      html: preview.html ?? '',
      unresolved: preview.unresolved ?? [],
      unknown: preview.unknown ?? [],
      couple: couple
        ? { name: couple.name, sample: false }
        : { name: ctx.couple?.name ?? 'Sample couple', sample: true },
    },
  }
}
