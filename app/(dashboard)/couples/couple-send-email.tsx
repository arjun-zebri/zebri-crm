/**
 * Couple "Send email" modal — the manual compose flow.
 *
 * Pick a saved template (or write inline), preview it filled against
 * the real couple, fill any missing variables inline, and send. The
 * Send button is blocked while a variable is missing; an explicit
 * "Send anyway" overrides that. The authoritative missing-variable gate
 * is re-applied server-side in `/api/email/send-template`.
 *
 * @module app/(dashboard)/couples/couple-send-email
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { detectMissingVariables, type VariableOverrides } from '@/lib/email/templates'
import { createClient } from '@/lib/supabase/client'
import type { EmailTemplate } from '@/types/email-template'

import { TemplatePreview } from '../templates/template-preview'

import { loadSendContextAction } from './send-email-actions'
import { SendEmailMissingPanel } from './send-email-missing-panel'

interface CoupleSendEmailProps {
  isOpen: boolean
  onClose: () => void
  coupleId: string
  coupleName: string
}

export function CoupleSendEmail({ isOpen, onClose, coupleId, coupleName }: CoupleSendEmailProps) {
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

  const [selectedId, setSelectedId] = useState('')
  const [overrides, setOverrides] = useState<VariableOverrides>({})
  const [sending, setSending] = useState(false)

  const selected = templates.find((t) => t.id === selectedId) ?? null
  const subject = selected?.subject ?? ''
  const content: JSONContent = useMemo(
    () => selected?.content ?? { type: 'doc', content: [] },
    [selected],
  )

  const missing = useMemo(() => {
    if (!ctx || !selected) return { missing: [], blocked: false }
    return detectMissingVariables({ subject, content }, ctx, overrides)
  }, [ctx, selected, subject, content, overrides])

  const send = async (sendAnyway: boolean) => {
    if (!selected) return
    setSending(true)
    try {
      const res = await fetch('/api/email/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupleId, templateId: selected.id, overrides, sendAnyway }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error || 'Could not send email', 'error')
        return
      }
      toast(`Email sent to ${coupleName}`, 'success')
      onClose()
    } catch {
      toast('Could not send email', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" title={`Email ${coupleName}`}>
      <div className="space-y-4">
        <Select
          label="Template"
          value={selectedId}
          onValueChange={setSelectedId}
          placeholder="Choose a template…"
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
        />

        {selected && ctx && (
          <>
            <SendEmailMissingPanel missing={missing.missing} overrides={overrides} onChange={setOverrides} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-text">Preview</p>
              <TemplatePreview subject={subject} content={content} ctx={ctx} overrides={overrides} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {missing.blocked ? (
                <Button variant="secondary" loading={sending} onClick={() => send(true)}>
                  Send anyway
                </Button>
              ) : (
                <Button loading={sending} onClick={() => send(false)}>
                  Send email
                </Button>
              )}
            </div>
          </>
        )}

        {selected && !ctx && <p className="py-6 text-center text-sm text-text-subtle">Loading couple details…</p>}
      </div>
    </Modal>
  )
}
