/**
 * Read side of `editor.storage.proposalEditor`
 * (`extensions/proposal-editor-storage.ts` is the write side, via a
 * command): the branding a node view needs for its WYSIWYG render.
 *
 * @module features/proposals/editor/node-views/editor-storage
 */
import type { Editor } from '@tiptap/react'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { PublicBranding } from '@/lib/branding/public-branding'

/**
 * Branding for a node view's shared renderer components. Falls back to an
 * empty business's defaults when the editor was mounted without the
 * `proposalEditor` extension (a bare test harness that builds its own
 * extension list), rather than throwing.
 */
export function readEditorBranding(editor: Editor): PublicBranding {
  return editor.storage.proposalEditor?.branding ?? buildPublicBranding({ business_name: '' })
}
