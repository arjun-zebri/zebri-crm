/**
 * Couple profile → Questionnaires tab.
 *
 * Lists the questionnaires sent to this couple, lets the MC send a new one
 * from a template, and opens a read-only answers panel. Mirrors the data shape
 * of the other couple sub-resource tabs (React Query + RLS-scoped client +
 * server action for the send). Answers are display-only in v1.
 *
 * @module app/(dashboard)/couples/couple-questionnaires
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { StatePill, type StatePillTone } from '@/components/ui/state-pill'
import { useToast } from '@/components/ui/toast'
import type { Question, Responses } from '@/lib/questionnaires/question-schema'
import { createClient } from '@/lib/supabase/client'

import { CoupleQuestionnaireAnswers } from './couple-questionnaire-answers'
import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'
import { sendCoupleQuestionnaireAction } from './questionnaire-actions'
import { QuestionnaireSendPreview } from './questionnaire-send-preview'

interface CoupleQuestionnaire {
  id: string
  title: string
  status: string
  sent_at: string | null
  completed_at: string | null
  questions: Question[]
  responses: Responses
}

const STATUS_TONE: Record<string, StatePillTone> = { draft: 'neutral', sent: 'info', completed: 'success' }

function fmt(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CoupleQuestionnaires({ coupleId }: { coupleId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [sendOpen, setSendOpen] = useState(false)
  const [preview, setPreview] = useState<{ id: string; name: string; questions: Question[] } | null>(null)
  const [active, setActive] = useState<CoupleQuestionnaire | null>(null)

  // The send popover is triggered from inside the couple-profile overlay
  // (z-[60]). Radix wraps popover content in a `transform`'d wrapper that
  // creates its own stacking context with `z-index: auto`, so a z-index on the
  // content alone stays trapped below the overlay. Portal the popover into a
  // dedicated container that owns a high z-index stacking context instead, so
  // the menu reliably floats above the profile. (`:has()` on the Radix wrapper
  // doesn't survive the Tailwind/Lightning CSS build, so we can't style it.)
  // Create the host element once (lazy init, never setState-in-effect), then
  // attach/detach it to the body for its lifetime. SSR-safe: returns null on
  // the server where `document` is undefined, falling back to Radix's default.
  const [popoverHost] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.style.position = 'relative'
    el.style.zIndex = '90'
    return el
  })
  useEffect(() => {
    if (!popoverHost) return
    document.body.appendChild(popoverHost)
    return () => {
      document.body.removeChild(popoverHost)
    }
  }, [popoverHost])

  const { data: questionnaires, isLoading } = useQuery({
    queryKey: ['couple-questionnaires', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couple_questionnaires')
        .select('id, title, status, sent_at, completed_at, questions, responses')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        questions: Array.isArray(r.questions) ? (r.questions as unknown as Question[]) : [],
        responses: (r.responses ?? {}) as Responses,
      })) as CoupleQuestionnaire[]
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['questionnaire-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('questionnaire_templates').select('id, name, questions').order('position')
      if (error) throw error
      return (data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        questions: Array.isArray(t.questions) ? (t.questions as unknown as Question[]) : [],
      }))
    },
  })

  const send = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await sendCoupleQuestionnaireAction({ coupleId, templateId })
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setSendOpen(false)
      setPreview(null)
      queryClient.invalidateQueries({ queryKey: ['couple-questionnaires', coupleId] })
      toast(data.emailSent ? 'Questionnaire sent' : 'Created — no email on file, copy the link to share')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to send', 'error'),
  })

  const all = questionnaires ?? []

  /**
   * Wraps a trigger button in the template-picker popover. The popover is a flat
   * menu: clicking a template opens its preview (the MC confirms what's going
   * out before sending, mirroring the quote/invoice/contract flow). Built as a
   * render helper (not a nested component) so it closes over live state without
   * remounting, and anchors to whichever Send button is on screen.
   *
   * z-index sits above the couple-profile overlay (z-[60]) and its nested
   * modals (z-[80]) so the menu is never occluded by the profile surface.
   */
  const sendPopover = (trigger: React.ReactNode, align: 'start' | 'end' | 'center') => (
    <Popover.Root open={sendOpen} onOpenChange={setSendOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={popoverHost ?? undefined}>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="min-w-64 rounded-xl border border-border bg-card py-1 shadow-xl animate-modal-in"
        >
          {(templates?.length ?? 0) === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">
              No questionnaire templates yet. Create one under Templates → Questionnaires.
            </p>
          ) : (
            (templates ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSendOpen(false)
                  setPreview(t)
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text transition hover:bg-surface-muted"
              >
                <span className="truncate">{t.name}</span>
                <Send size={14} strokeWidth={1.5} className="shrink-0 text-text-muted" />
              </button>
            ))
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )

  const completedCount = all.filter((q) => q.status === 'completed').length
  const sentCount = all.filter((q) => q.status === 'sent').length
  const draftCount = all.filter((q) => q.status === 'draft').length
  const stats: TabStat[] = [{ label: `${all.length} total` }]
  if (completedCount > 0) stats.push({ label: `${completedCount} completed`, tone: 'success' })
  if (sentCount > 0) stats.push({ label: `${sentCount} sent` })
  if (draftCount > 0) stats.push({ label: tabStat(draftCount, 'draft') })

  return (
    <>
      <CoupleTabShell
        title="Questionnaires"
        stats={all.length > 0 ? stats : undefined}
        actions={sendPopover(
          <Button size="sm" className="cursor-pointer gap-1.5">
            <Send size={14} strokeWidth={1.5} />
            Send questionnaire
          </Button>,
          'end',
        )}
      >
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-muted" />)}</div>
        ) : all.length === 0 ? (
          <CoupleTabEmpty
            icon={ClipboardList}
            title="No questionnaires sent yet"
            description="Send one from a template above."
          />
        ) : (
          <div className="space-y-1">
            {all.map((q) => (
              <button
                key={q.id}
                onClick={() => setActive(q)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-muted"
              >
                <ClipboardList size={15} strokeWidth={1.5} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">{q.title}</p>
                  <p className="text-xs text-text-subtle">
                    {q.status === 'completed' ? `Completed ${fmt(q.completed_at)}` : q.sent_at ? `Sent ${fmt(q.sent_at)}` : 'Draft'}
                  </p>
                </div>
                <StatePill label={q.status} tone={STATUS_TONE[q.status] ?? 'neutral'} />
              </button>
            ))}
          </div>
        )}
      </CoupleTabShell>

      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `Send ${preview.name}` : ''}
        size="lg"
        nested
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => preview && send.mutate(preview.id)} disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        }
      >
        {preview && <QuestionnaireSendPreview key={preview.id} name={preview.name} questions={preview.questions} />}
      </Modal>

      <Modal isOpen={!!active} onClose={() => setActive(null)} title={active?.title ?? ''} size="fullscreen" nested>
        {active && <CoupleQuestionnaireAnswers questions={active.questions} responses={active.responses} />}
      </Modal>
    </>
  )
}
