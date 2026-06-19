/**
 * Couple "Send email" modal — the manual compose flow.
 *
 * Pick a saved template (in the picker popover), then edit the finished
 * email directly in an editable preview before sending. Variables are
 * resolved against the real couple up front; anything the couple is
 * missing is flagged in a banner so the MC can fill it in place. The
 * edited subject + body are sent inline, so what the MC sees is exactly
 * what goes out.
 *
 * @module app/(dashboard)/couples/couple-send-email
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/toast'
import { variableLabel } from '@/lib/automations/variables'
import {
  detectMissingVariables,
  renderEmailSubject,
  resolveTemplateContent,
} from '@/lib/email/templates'
import { createClient } from '@/lib/supabase/client'
import type { EmailTemplate } from '@/types/email-template'

import { loadSendContextAction } from './send-email-actions'

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

interface CoupleSendEmailProps {
  isOpen: boolean
  onClose: () => void
  coupleId: string
  coupleName: string
  /** `'send'` delivers to the couple; `'test'` delivers to the MC's own
   *  inbox (bracketed `[Test]` subject) and isn't logged. Defaults to send. */
  mode?: 'send' | 'test'
  /** Pre-select this template (the picker popover passes the chosen one). */
  initialTemplateId?: string
  /** Fired after a successful real send so the caller can refresh history. */
  onSent?: () => void
}

export function CoupleSendEmail({
  isOpen,
  onClose,
  coupleId,
  coupleName,
  mode = 'send',
  initialTemplateId,
  onSent,
}: CoupleSendEmailProps) {
  const isTest = mode === 'test'
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    enabled: isOpen,
    queryFn: async (): Promise<EmailTemplate[]> => {
      const { data, error } = await supabase.from('email_templates').select('*').order('position')
      if (error) throw error
      return (data ?? []) as unknown as EmailTemplate[]
    },
  })

  const { data: ctxResult } = useQuery({
    queryKey: ['send-context', coupleId],
    enabled: isOpen,
    queryFn: () => loadSendContextAction(coupleId),
  })
  const ctx = ctxResult?.ok ? ctxResult.ctx : null

  const [sending, setSending] = useState(false)

  // Template is chosen in the picker popover; this modal is edit-only.
  const selected = templates.find((t) => t.id === initialTemplateId) ?? null

  // The editable email — seeded once (per template) with the template
  // resolved against the real couple, then owned by the MC's edits.
  const [editSubject, setEditSubject] = useState('')
  const [editContent, setEditContent] = useState<JSONContent>(EMPTY_DOC)
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!selected || !ctx) return
    if (seededFor.current === selected.id) return
    seededFor.current = selected.id
    setEditSubject(renderEmailSubject(selected.subject, ctx, 'preview'))
    setEditContent(resolveTemplateContent(selected.content ?? EMPTY_DOC, ctx))
  }, [selected, ctx])

  // Heads-up only: which variables the template couldn't fill from the
  // couple. The MC fixes these by editing the email below — there's no
  // separate input to fill.
  const missing = useMemo(() => {
    if (!ctx || !selected) return [] as string[]
    return detectMissingVariables({ subject: selected.subject, content: selected.content }, ctx).missing
  }, [ctx, selected])

  const send = async () => {
    if (!selected) return
    setSending(true)
    try {
      const res = await fetch('/api/email/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupleId,
          templateId: selected.id,
          inlineSubject: editSubject,
          inlineBody: editContent,
          sendAnyway: true,
          test: isTest,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error || 'Could not send email', 'error')
        return
      }
      toast(isTest ? 'Test sent to your inbox' : `Email sent to ${coupleName}`, 'success')
      if (!isTest) onSent?.()
      onClose()
    } catch {
      toast('Could not send email', 'error')
    } finally {
      setSending(false)
    }
  }

  // The editor can't seed until both the template and the couple context
  // have loaded. `fullscreen` locks the modal to the couple-overlay's
  // dimensions so it doesn't jump from a loading box to its full size.
  const loading = !selected || !ctx

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="fullscreen" title={isTest ? 'Test template' : `Email ${coupleName}`}>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {loading ? (
            <ComposeSkeleton />
          ) : (
            <>
              {missing.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
                  <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">
                    This couple is missing{' '}
                    <span className="font-medium">{missing.map(variableLabel).join(', ')}</span>. Fill{' '}
                    {missing.length === 1 ? 'the highlighted gap' : 'the highlighted gaps'} in the email below before
                    sending. It won&apos;t change their record.
                  </p>
                </div>
              )}
              <Input label="Subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              <div>
                <p className="mb-1.5 text-sm font-medium text-text">Email</p>
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  showVariableInserter={false}
                  mentionDisplay="label"
                  placeholder="Write your email…"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={sending} disabled={loading} onClick={send}>
            {isTest ? 'Send test to me' : 'Send email'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Pulsing placeholder mirroring the compose form while it loads, so the
 *  fullscreen modal stays a fixed size instead of snapping in. */
function ComposeSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div>
        <div className="mb-1.5 h-3 w-14 animate-pulse rounded bg-surface-muted" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-surface-muted" />
      </div>
      <div>
        <div className="mb-1.5 h-4 w-12 animate-pulse rounded bg-surface-muted" />
        <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
          <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-muted" />
          <div className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-3.5 w-11/12 animate-pulse rounded bg-surface-muted" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    </div>
  )
}
