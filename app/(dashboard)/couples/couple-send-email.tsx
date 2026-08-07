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
import { AlertTriangle, FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/toast'
import { variableLabel } from '@/lib/automations/variables'
import { renderSignatureHtml } from '@/lib/email/signature'
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
      // Archived templates stay out of the send picker (soft retirement).
      // Filtered client-side so a deploy that beats the migration
      // degrades to "no filter" instead of a failed query.
      return ((data ?? []) as unknown as EmailTemplate[]).filter((t) => !t.archived_at)
    },
  })

  const { data: ctxResult } = useQuery({
    queryKey: ['send-context', coupleId],
    enabled: isOpen,
    queryFn: () => loadSendContextAction(coupleId),
  })
  const ctx = ctxResult?.ok ? ctxResult.ctx : null

  // The template's saved attachments — included by default, each
  // deselectable for this send only.
  const { data: templateFiles = [] } = useQuery({
    queryKey: ['email-template-files', initialTemplateId ?? null],
    enabled: isOpen && !!initialTemplateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_template_files')
        .select('id, file_name, file_size')
        .eq('template_id', initialTemplateId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
  const [excludedFileIds, setExcludedFileIds] = useState<Set<string>>(new Set())

  const [sending, setSending] = useState(false)

  // Template is chosen in the picker popover; this modal is edit-only.
  const selected = templates.find((t) => t.id === initialTemplateId) ?? null

  // The editable email — seeded once (per template) with the template
  // resolved against the real couple, then owned by the MC's edits.
  // `seeded` gates the editor mount: we render the skeleton until the
  // resolved content exists, so the editor is created *with* the filled
  // body rather than mounting empty and racing a sync effect to catch up.
  // That race is what made variables resolve on the first open but not the
  // next. `seeded` resets with the component on every open (fresh mount).
  const [editSubject, setEditSubject] = useState('')
  const [editContent, setEditContent] = useState<JSONContent>(EMPTY_DOC)
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (seeded || !selected || !ctx) return
    setEditSubject(renderEmailSubject(selected.subject, ctx, 'preview'))
    setEditContent(resolveTemplateContent(selected.content ?? EMPTY_DOC, ctx))
    setSeeded(true)
  }, [seeded, selected, ctx])

  // Heads-up only: which variables the template couldn't fill from the
  // couple. The MC fixes these by editing the email below — there's no
  // separate input to fill.
  const missing = useMemo(() => {
    if (!ctx || !selected) return [] as string[]
    return detectMissingVariables({ subject: selected.subject, content: selected.content }, ctx).missing
  }, [ctx, selected])

  // Pre-rendered, sanitised signature HTML so the editor can show the
  // `{{mc.signature}}` mention inline as the finished block. Empty string
  // when the MC hasn't set a signature.
  const signatureHtml = useMemo(() => (ctx ? renderSignatureHtml(ctx.mc.signature) : ''), [ctx])

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
          attachmentFileIds: templateFiles.filter((f) => !excludedFileIds.has(f.id)).map((f) => f.id),
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

  // The editor can't mount until the template + couple context have loaded
  // AND the body has been seeded with the resolved content.
  const loading = !selected || !ctx || !seeded

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // Sized to an email's width (not fullscreen) so the compose surface
      // reads like the message it composes.
      size="lg"
      title={isTest ? 'Test template' : `Email ${coupleName}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={sending} disabled={loading} onClick={send}>
            {isTest ? 'Send test to me' : 'Send email'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {loading || !ctx ? (
          <ComposeSkeleton />
        ) : (
          <>
            {missing.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-control border border-red-200 bg-red-50 p-3">
                <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-600" />
                <p className="text-body text-red-700">
                  This couple is missing{' '}
                  <span className="font-medium">{missing.map(variableLabel).join(', ')}</span>. Fill{' '}
                  {missing.length === 1 ? 'the highlighted gap' : 'the highlighted gaps'} in the email below before
                  sending. It won&apos;t change their record.
                </p>
              </div>
            )}
            <Input label="Subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            <div>
              <p className="mb-1.5 text-body font-medium text-text">Email</p>
              {/* `signatureHtml` makes the `{{mc.signature}}` mention render
                  inline as the finished signature; select it and press
                  Delete to remove it. */}
              <RichTextEditor
                value={editContent}
                onChange={setEditContent}
                showVariableInserter={false}
                mentionDisplay="label"
                signatureHtml={signatureHtml}
                placeholder="Write your email…"
              />
            </div>
            {templateFiles.length > 0 && (
              <div>
                <p className="mb-1.5 text-body font-medium text-text">Attachments</p>
                <ul className="space-y-1">
                  {templateFiles.map((f) => (
                    <li key={f.id} className="flex items-center gap-2.5">
                      <Checkbox
                        checked={!excludedFileIds.has(f.id)}
                        onChange={(next) =>
                          setExcludedFileIds((prev) => {
                            const out = new Set(prev)
                            if (next) out.delete(f.id)
                            else out.add(f.id)
                            return out
                          })
                        }
                        label={
                          <span className="flex items-center gap-1.5 text-body text-text">
                            <FileText size={14} strokeWidth={1.5} className="text-text-subtle" />
                            {f.file_name}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** Pulsing placeholder mirroring the compose form while it loads, so the
 *  modal doesn't snap from a loading box to its full height. */
function ComposeSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div>
        <div className="mb-1.5 h-3 w-14 animate-pulse rounded-control bg-surface-muted" />
        <div className="h-10 w-full animate-pulse rounded-control bg-surface-muted" />
      </div>
      <div>
        <div className="mb-1.5 h-4 w-12 animate-pulse rounded-control bg-surface-muted" />
        <div className="space-y-3 rounded-control border border-border bg-card px-4 py-4">
          <div className="h-3.5 w-1/3 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-3.5 w-full animate-pulse rounded-control bg-surface-muted" />
          <div className="h-3.5 w-11/12 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-3.5 w-4/5 animate-pulse rounded-control bg-surface-muted" />
        </div>
      </div>
    </div>
  )
}
