/**
 * Compose modal for the "Send run sheet" step.
 *
 * Same shape as the questionnaire step, because the step is the same
 * shape: the email is the handler's — subject, shell, message and
 * link — and the one thing the MC decides is who receives it. So the
 * modal is that choice and a preview of what lands.
 *
 * The couple and the suppliers receive different copy (a supplier
 * checks their own slot; the couple is looking at their own day), so
 * the preview has a tab per audience once both are selected. Showing
 * one of them would be showing half the step.
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
import { RUN_SHEET_COUPLE_MESSAGE, RUN_SHEET_MESSAGE } from '@/lib/automations/actions/timeline'
import { renderTemplate } from '@/lib/automations/variables'
import { wrapAutomationShell } from '@/lib/email/html'
import { buildSampleContext } from '@/lib/email/template-variables'

import { loadSenderIdentityAction } from '../actions'

import { RUN_SHEET_CHIP } from './action-chips'
import { EmailPreview } from './email-preview'
import { TriggerFilterList, type FilterConfig } from './trigger-filter-list'

/**
 * Stands in for the run sheet the step will actually link to. A real
 * URL, not an ellipsis: `wrapAutomationShell` only renders the button
 * for a link it can trust as http(s).
 */
const SAMPLE_LINK = 'https://app.zebri.com.au/timeline/sample'

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
  // own words for every recipient, and the preview has to show those
  // rather than a default it no longer uses.
  const saved = typeof draft['message'] === 'string' ? draft['message'] : null
  const custom = saved && saved !== RUN_SHEET_MESSAGE ? saved : null

  // Suppliers and the couple get different copy, so the preview has a
  // tab per audience — showing one of them would be showing half the
  // step.
  const audiences = useMemo(() => {
    const rows: { key: string; label: string; message: string }[] = []
    if (draft['sendToVendors'] !== false || draft['sendToMe'] === true) {
      rows.push({
        key: 'suppliers',
        label: draft['sendToVendors'] === false ? 'To me' : 'To suppliers',
        message: custom ?? RUN_SHEET_MESSAGE,
      })
    }
    if (draft['sendToCouple'] === true) {
      rows.push({ key: 'couple', label: 'To the couple', message: custom ?? RUN_SHEET_COUPLE_MESSAGE })
    }
    return rows.length ? rows : [{ key: 'suppliers', label: 'To suppliers', message: custom ?? RUN_SHEET_MESSAGE }]
  }, [draft, custom])

  const [shown, setShown] = useState(0)
  // The audience list shrinks when a chip is unticked; keep the tab
  // in range rather than previewing nothing.
  const active = audiences[Math.min(shown, audiences.length - 1)]!

  const previewHtml = useMemo(() => {
    // The MC's real name and address, so the sign-off previews as the
    // person it will be signed by rather than the sample's "You".
    const ctx = buildSampleContext({
      businessName,
      ...(identity?.contactName ? { contactName: identity.contactName } : {}),
      ...(identity?.email ? { email: identity.email } : {}),
    })
    // The handler's own call: the message, then the button and its
    // copyable address.
    return wrapAutomationShell(renderTemplate(active.message, ctx), businessName, {
      label: 'View run sheet',
      url: SAMPLE_LINK,
    })
  }, [active, businessName, identity])

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

        <EmailPreview
          ready={identity !== undefined}
          subject={`Run sheet for Sam & Alex - ${businessName}`}
          html={previewHtml}
          frameTitle="Run sheet email preview"
          caption="Shown with a sample couple and link."
          actions={
            audiences.length > 1 ? (
              <div className="flex gap-1">
                {audiences.map((audience, index) => (
                  <button
                    key={audience.key}
                    type="button"
                    onClick={() => setShown(index)}
                    className={`h-8 cursor-pointer rounded-pill px-3 text-body transition-colors ${
                      audience.key === active.key
                        ? 'bg-surface-emphasis font-medium text-text'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {audience.label}
                  </button>
                ))}
              </div>
            ) : null
          }
        />
      </div>
    </Modal>
  )
}
