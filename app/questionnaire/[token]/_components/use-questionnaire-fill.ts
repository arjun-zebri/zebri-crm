/**
 * State + persistence for the couple filling a public questionnaire.
 *
 * Owns the responses map, a debounced autosave against
 * `/api/questionnaire/save` with a visible save state (so a dropped
 * connection is never silent), and the final submit against
 * `/api/questionnaire/submit`. The renderers (typeform / classic form) stay
 * purely presentational on top of this.
 *
 * @module app/questionnaire/[token]/_components/use-questionnaire-fill
 */
'use client'

import { useEffect, useRef, useState } from 'react'

import type { SaveState } from '@/components/questionnaires/save-state'
import type { Answer, Responses } from '@/lib/questionnaires/question-schema'

interface UseQuestionnaireFill {
  responses: Responses
  setAnswer: (questionId: string, value: Answer) => void
  saveState: SaveState
  submit: () => void
  submitting: boolean
  submitError: string | null
}

/**
 * Call from a component that mounts once the questionnaire has loaded (the
 * fill section, not the page shell), so `initialResponses` — the couple's
 * saved draft — is final at first render.
 */
export function useQuestionnaireFill(token: string, initialResponses: Responses | null, onCompleted: () => void): UseQuestionnaireFill {
  const [responses, setResponses] = useState<Responses>(initialResponses ?? {})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirror of `responses` so event handlers always build on the latest map
  // (only ever touched from handlers, never during render).
  const responsesRef = useRef<Responses>(initialResponses ?? {})

  // Debounced autosave, scheduled from the answer handler (not an effect). A
  // failed save is surfaced (saveState 'error') and retried on the next
  // change and on final submit.
  const scheduleSave = (next: Responses) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => {
      void fetch('/api/questionnaire/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses: next }),
      })
        .then((res) => setSaveState(res.ok ? 'saved' : 'error'))
        .catch(() => setSaveState('error'))
    }, 800)
  }

  // Unmount cleanup only — no state writes here.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const setAnswer = (questionId: string, value: Answer) => {
    setSubmitError(null)
    const next = { ...responsesRef.current, [questionId]: value }
    responsesRef.current = next
    setResponses(next)
    scheduleSave(next)
  }

  const submit = () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    // Cancel any in-flight autosave; submit persists everything.
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void fetch('/api/questionnaire/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, responses: responsesRef.current }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        setSubmitting(false)
        if (!res.ok || data.error) {
          setSubmitError("We couldn't send your answers just now. They're saved here, so please try again in a moment.")
          return
        }
        onCompleted()
      })
      .catch(() => {
        setSubmitting(false)
        setSubmitError('It looks like the connection dropped. Your answers are saved here, so please try again.')
      })
  }

  return { responses, setAnswer, saveState, submit, submitting, submitError }
}
