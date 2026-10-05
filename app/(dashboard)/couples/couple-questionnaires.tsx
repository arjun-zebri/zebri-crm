/**
 * Couple profile → Questionnaires tab.
 *
 * Lists the questionnaires sent to this couple with their lifecycle (sent →
 * opened → in progress → completed), lets the MC send a new one from a
 * template (with a faithful preview), copy/resend/disable the share link, and
 * open the answers panel (read, print, or edit on the couple's behalf).
 * Mirrors the data shape of the other couple sub-resource tabs (React Query +
 * RLS-scoped client + server actions for anything that emails).
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
import { useToast } from '@/components/ui/toast'
import { toDisplayMode, type Question, type QuestionnaireDisplayMode, type Responses } from '@/lib/questionnaires/question-schema'
import { labelVariables } from '@/lib/questionnaires/variables'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

import { CoupleQuestionnaireAnswers } from './couple-questionnaire-answers'
import { CoupleQuestionnaireRow } from './couple-questionnaire-row'
import { CoupleTabEmpty, CoupleTabShell, tabStat, type TabStat } from './couple-tab-shell'
import { resendCoupleQuestionnaireAction, sendCoupleQuestionnaireAction } from './questionnaire-actions'
import { previewCoupleQuestionnaireAction, type InviteEmailState } from './questionnaire-preview-actions'
import { QuestionnaireSendPreview } from './questionnaire-send-preview'

/** One questionnaire instance as this tab reads it. */
export interface CoupleQuestionnaire {
  id: string
  title: string
  status: string
  display_mode: QuestionnaireDisplayMode
  sent_at: string | null
  viewed_at: string | null
  completed_at: string | null
  share_token: string
  share_token_enabled: boolean
  questions: Question[]
  responses: Responses
}

interface TemplateOption {
  id: string
  name: string
  display_mode: QuestionnaireDisplayMode
  questions: Question[]
  /** The chosen email template's name; null = the standard email. */
  emailName: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

/** The Send modal's "Email:" line, including why a chosen email is not used. */
function emailLine(chosenName: string | null, state: InviteEmailState | undefined): string {
  if (!chosenName || state === 'standard') return 'Standard questionnaire email'
  if (state === 'no_link') return `Standard email (${chosenName} has no questionnaire link)`
  if (state === 'unfilled') return `Standard email (${chosenName} needs details this couple is missing)`
  return chosenName
}

export function CoupleQuestionnaires({ coupleId, coupleName }: { coupleId: string; coupleName: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [sendOpen, setSendOpen] = useState(false)
  const [preview, setPreview] = useState<TemplateOption | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

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
        .select('id, title, status, display_mode, sent_at, viewed_at, completed_at, share_token, share_token_enabled, questions, responses')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        display_mode: toDisplayMode(r.display_mode),
        questions: Array.isArray(r.questions) ? (r.questions as unknown as Question[]) : [],
        responses: (r.responses ?? {}) as Responses,
      })) as CoupleQuestionnaire[]
    },
  })

  // What this couple would actually get: names filled, chosen email rendered.
  const { data: sendPreview } = useQuery({
    queryKey: ['questionnaire-send-preview', coupleId, preview?.id],
    enabled: !!preview,
    queryFn: async () => {
      const res = await previewCoupleQuestionnaireAction({ coupleId, templateId: preview!.id })
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
  })

  const { data: templates } = useQuery({
    // Its own key under the manager's prefix: the two queries store
    // different shapes, and sharing one key let whichever loaded first
    // hand the other the wrong rows. The manager's save still refreshes
    // this through prefix invalidation.
    queryKey: ['questionnaire-templates', 'send-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaire_templates')
        .select('id, name, display_mode, questions, email_templates(name, archived_at)')
        .order('position')
      if (error) throw error
      return (data ?? []).map((t): TemplateOption => {
        // An archived email template is skipped at send, so say so here too.
        const email = t.email_templates
        return {
          id: t.id,
          name: t.name,
          display_mode: toDisplayMode(t.display_mode),
          questions: Array.isArray(t.questions) ? (t.questions as unknown as Question[]) : [],
          emailName: email && !email.archived_at ? email.name : null,
        }
      })
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['couple-questionnaires', coupleId] })

  const send = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await sendCoupleQuestionnaireAction({ coupleId, templateId })
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setSendOpen(false)
      setPreview(null)
      invalidate()
      toast(data.emailSent ? 'Questionnaire sent' : 'Created. No email on file, so use Copy link on the row to share it')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to send', 'error'),
  })

  const resend = useMutation({
    mutationFn: async (questionnaireId: string) => {
      const res = await resendCoupleQuestionnaireAction({ questionnaireId })
      if (!res.ok) throw new Error(res.error)
    },
    onSuccess: () => {
      invalidate()
      toast('Email sent again')
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Failed to resend', 'error'),
  })

  const toggleLink = useMutation({
    mutationFn: async (q: CoupleQuestionnaire) => {
      const { error } = await supabase
        .from('couple_questionnaires')
        .update({ share_token_enabled: !q.share_token_enabled })
        .eq('id', q.id)
      if (error) throw error
      return !q.share_token_enabled
    },
    onSuccess: (enabled) => {
      invalidate()
      toast(enabled ? 'Link turned on' : 'Link turned off. The couple can no longer open it')
    },
    onError: () => toast('Failed to update the link', 'error'),
  })

  const saveResponses = useMutation({
    mutationFn: async ({ id, responses }: { id: string; responses: Responses }) => {
      const { error } = await supabase
        .from('couple_questionnaires')
        .update({ responses: responses as Database['public']['Tables']['couple_questionnaires']['Row']['responses'] })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast('Answers saved')
    },
    onError: () => toast('Failed to save answers', 'error'),
  })

  const copyLink = async (q: CoupleQuestionnaire) => {
    await navigator.clipboard.writeText(`${APP_URL}/questionnaire/${q.share_token}`)
    toast(q.share_token_enabled ? 'Link copied' : 'Link copied, but note the link is currently turned off')
  }

  const all = questionnaires ?? []
  const active = all.find((q) => q.id === activeId) ?? null

  /**
   * Wraps a trigger button in the template-picker popover. The popover is a flat
   * menu: clicking a template opens its preview (the MC confirms what's going
   * out before sending, mirroring the quote/invoice/contract flow). Built as a
   * render helper (not a nested component) so it closes over live state without
   * remounting, and anchors to whichever Send button is on screen.
   */
  const sendPopover = (trigger: React.ReactNode, align: 'start' | 'end' | 'center') => (
    <Popover.Root open={sendOpen} onOpenChange={setSendOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={popoverHost ?? undefined}>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="min-w-64 rounded-control border border-border bg-card py-1 shadow-xl animate-modal-in"
        >
          {(templates?.length ?? 0) === 0 ? (
            <p className="px-3 py-2 text-body text-text-muted">
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
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-body text-text transition hover:bg-surface-muted"
              >
                <span className="truncate">{labelVariables(t.name)}</span>
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
          <Button className="cursor-pointer gap-1.5">
            <Send size={14} strokeWidth={1.5} />
            Send questionnaire
          </Button>,
          'end',
        )}
      >
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-control bg-surface-muted" />)}</div>
        ) : all.length === 0 ? (
          <CoupleTabEmpty
            icon={ClipboardList}
            title="No questionnaires sent yet"
            description="Send one from a template above."
          />
        ) : (
          <div className="space-y-1">
            {all.map((q) => (
              <CoupleQuestionnaireRow
                key={q.id}
                questionnaire={q}
                onOpen={() => setActiveId(q.id)}
                onCopyLink={() => void copyLink(q)}
                onResend={() => resend.mutate(q.id)}
                onToggleLink={() => toggleLink.mutate(q)}
              />
            ))}
          </div>
        )}
      </CoupleTabShell>

      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `Send ${labelVariables(preview.name)}` : ''}
        size="2xl"
        nested
        footer={
          <div className="flex items-center justify-end gap-2">
            {preview && (
              <p className="mr-auto truncate text-body text-text-muted">
                Email: {emailLine(preview.emailName, sendPreview?.emailState)}
              </p>
            )}
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={() => preview && send.mutate(preview.id)} disabled={send.isPending} loading={send.isPending}>Send</Button>
          </div>
        }
      >
        {preview && (
          <QuestionnaireSendPreview
            key={preview.id}
            // The couple's own names once the server preview lands; the
            // variable labels until then.
            name={sendPreview?.title ?? labelVariables(preview.name)}
            questions={sendPreview?.questions ?? preview.questions.map((q) => ({ ...q, label: labelVariables(q.label) }))}
            email={sendPreview?.email ?? null}
            displayMode={preview.display_mode}
            coupleName={coupleName}
          />
        )}
      </Modal>

      <Modal isOpen={!!active} onClose={() => setActiveId(null)} title={active?.title ?? ''} size="fullscreen" nested>
        {active && (
          <CoupleQuestionnaireAnswers
            key={active.id}
            title={active.title}
            coupleName={coupleName}
            sentAt={active.sent_at}
            completedAt={active.completed_at}
            questions={active.questions}
            responses={active.responses}
            onSaveResponses={(responses) => saveResponses.mutateAsync({ id: active.id, responses })}
            saving={saveResponses.isPending}
          />
        )}
      </Modal>
    </>
  )
}
