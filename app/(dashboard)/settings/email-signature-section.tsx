/**
 * Settings → Signature. Edits the MC's reusable email signature, a plain
 * rich-text block (like an Outlook / Gmail signature) stored on
 * `user_metadata.email_signature`. Just formatting, no template variables
 * inside it. Templates drop the whole signature in via the
 * `{{mc.signature}}` variable.
 *
 * Auto-saves: a change debounces a save after 800ms, and a blur out of the
 * editor flushes immediately. Both go through one idempotent `save()` that
 * no-ops when nothing changed, so the last edit can never be lost to blur
 * timing (the editor's popovers steal focus, which makes blur alone
 * unreliable for a rich editor).
 *
 * @module app/(dashboard)/settings/email-signature-section
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

import { SignatureEditor } from '@/components/ui/signature-editor'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

import { AutoSaveStatus, type SaveState } from './auto-save-status'

/** An empty TipTap doc, the starting point for an unset signature. */
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Debounce before saving after the last edit. */
const SAVE_DEBOUNCE_MS = 800

export interface EmailSignatureSectionProps {
  /** The saved signature, or `null` when the MC hasn't set one yet. */
  initialContent: JSONContent | null
}

export function EmailSignatureSection({ initialContent }: EmailSignatureSectionProps) {
  const [content, setContent] = useState<JSONContent>(initialContent ?? EMPTY_DOC)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const { toast } = useToast()

  // Last-persisted baseline (serialised) so an unchanged save is a no-op
  // and a successful save clears "dirty" without remounting.
  const savedRef = useRef(JSON.stringify(initialContent ?? EMPTY_DOC))
  const savingRef = useRef(false)
  // Latest content for the debounced/blur save to read, avoiding stale
  // closures.
  const contentRef = useRef(content)
  contentRef.current = content

  const save = async () => {
    const serialized = JSON.stringify(contentRef.current)
    if (serialized === savedRef.current || savingRef.current) return
    savingRef.current = true
    setSaveState('saving')

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast('Unable to load user data.', 'error')
      setSaveState('error')
      savingRef.current = false
      return
    }

    const { error } = await supabase.auth.updateUser({
      data: { ...(user.user_metadata || {}), email_signature: contentRef.current },
    })
    if (error) {
      toast(error.message, 'error')
      setSaveState('error')
      savingRef.current = false
      return
    }

    savedRef.current = serialized
    setSaveState('saved')
    savingRef.current = false
  }

  // Debounced save after the last edit.
  useEffect(() => {
    if (JSON.stringify(content) === savedRef.current) return
    const t = setTimeout(() => void save(), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // `save` reads the latest content via contentRef, so content is the only dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Signature</h2>
      <p className="text-sm text-text-muted mb-5">
        The sign-off added to your emails: your name, business, and any links. Drop it into any
        template with the <span className="font-medium text-gray-700">Your email signature</span>{' '}
        variable. Changes save automatically.
      </p>

      {/* Blur out of the editor region flushes a save immediately; the
          debounced effect covers edits made without blurring. */}
      <div
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save()
        }}
      >
        <SignatureEditor
          value={content}
          onChange={setContent}
          placeholder="Warm regards, your name..."
        />
      </div>

      <div className="flex items-center gap-3 pt-3 h-5">
        <AutoSaveStatus state={saveState} />
      </div>
    </div>
  )
}
