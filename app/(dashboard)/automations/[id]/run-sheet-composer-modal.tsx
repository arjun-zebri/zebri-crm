/**
 * Compose modal for the "Send run sheet" step.
 *
 * Same shape as the questionnaire step, because the step is the same
 * shape: the email is the handler's — subject, shell, message and
 * link — and the one thing the MC decides is who receives it. So the
 * modal is that choice and a preview of what lands.
 *
 * The preview calls `wrapAutomationShell`, the builder the handler
 * wraps its body in, and resolves the message through the same
 * renderer, so it cannot drift from what is sent. A sample couple
 * stands in for the one the run will be about.
 *
 * @module app/(dashboard)/automations/[id]/run-sheet-composer-modal
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { RUN_SHEET_MESSAGE } from '@/lib/automations/actions/timeline'
import { renderTemplate } from '@/lib/automations/variables'
import { wrapAutomationShell } from '@/lib/email/html'
import { buildSampleContext } from '@/lib/email/template-variables'

import { loadSenderIdentityAction } from '../actions'

import { RUN_SHEET_CHIP } from './action-chips'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

/** Stands in for the run sheet the step will actually link to. */
const SAMPLE_LINK = 'https://app.zebri.com.au/timeline/…'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function RunSheetComposerModal({ isOpen, onClose, config, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  // Hydrate on open, not on every config change: re-seeding mid-edit
  // would fight the chip.
  useEffect(() => {
    if (!isOpen) return
    setDraft({ ...config })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const { data: identity } = useQuery({
    queryKey: ['automation-sender-identity'],
    enabled: isOpen,
    queryFn: () => loadSenderIdentityAction(),
  })

  const businessName = identity?.businessName ?? 'Your business'
  // A step saved before the message stopped being editable keeps its
  // own words, and the preview has to show those rather than the
  // default it no longer uses.
  const message = typeof draft['message'] === 'string' ? draft['message'] : RUN_SHEET_MESSAGE

  const previewHtml = useMemo(() => {
    const ctx = buildSampleContext({ businessName })
    // The handler's own shape: the rendered message, then the link on
    // its own line.
    return wrapAutomationShell(`${renderTemplate(message, ctx)}\n\n${SAMPLE_LINK}`, businessName)
  }, [message, businessName])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send run sheet"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-body font-medium text-text">Send to</p>
          <TriggerFilterList
            filters={[RUN_SHEET_CHIP]}
            config={draft as FilterConfig}
            setConfig={(c) => setDraft(c as Record<string, unknown>)}
          />
        </div>

        <div>
          <p className="mb-1.5 text-body font-medium text-text">Preview</p>
          <div className="overflow-hidden rounded-control border border-border">
            <div className="border-b border-border bg-surface-muted px-4 py-3">
              <p className="text-body text-text-subtle">Subject</p>
              {/* The exact subject the handler builds. */}
              <p className="text-body font-medium text-text">
                Run sheet for Sam &amp; Alex - {businessName}
              </p>
            </div>
            {/* `srcDoc` can be bound directly here: nothing in this
                modal is typed, so the frame reloads only when the
                identity query lands, not on every keystroke. */}
            <iframe
              // `allow-same-origin` and nothing else: scripts, forms
              // and popups stay blocked.
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
              title="Run sheet email preview"
              className="h-80 w-full bg-white"
            />
          </div>
          <p className="mt-1.5 text-body text-text-muted">
            Shown with a sample couple and link.
          </p>
        </div>
      </div>
    </Modal>
  )
}
