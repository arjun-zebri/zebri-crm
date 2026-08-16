/**
 * Preview modal for the `send_contract` and `send_invoice` steps.
 *
 * Both are zero-config: the handler picks the couple's most recent
 * contract or invoice and sends it as saved. Every field their old
 * schemas carried (`templateId`, `signersRequired`, `expiryDays`,
 * `customMessage`, the invoice's payment fields) was declared and
 * never read.
 *
 * So there is nothing to fill in, and the only question worth
 * answering is what the couple receives. Same treatment as the
 * questionnaire step: a preview built by the same pure builder the
 * sender calls, with a sample document standing in for the real one.
 *
 * @module app/(dashboard)/automations/[id]/document-composer-modal
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractHtml, invoiceHtml } from '@/lib/email/html'

import { loadSenderIdentityAction } from '../actions'

/** Which document the step sends. */
export type DocumentKind = 'contract' | 'invoice'

/** Stands in for the couple and document the run will be about. */
const SAMPLE_COUPLE = 'Sam & Alex'

interface Props {
  isOpen: boolean
  onClose: () => void
  kind: DocumentKind
}

const COPY: Record<DocumentKind, { title: string; number: string; docTitle: string }> = {
  contract: { title: 'Send contract', number: 'CTR-001', docTitle: 'Wedding MC agreement' },
  invoice: { title: 'Send invoice', number: 'INV-001', docTitle: 'Wedding MC services' },
}

export function DocumentComposerModal({ isOpen, onClose, kind }: Props) {
  const { data: identity } = useQuery({
    queryKey: ['automation-sender-identity'],
    enabled: isOpen,
    queryFn: () => loadSenderIdentityAction(),
  })

  const businessName = identity?.businessName ?? 'Your business'
  const copy = COPY[kind]

  const previewHtml = useMemo(() => {
    const shared = {
      coupleName: SAMPLE_COUPLE,
      shareUrl: `https://app.zebri.com.au/${kind}/…`,
      mcBusinessName: businessName,
    }
    return kind === 'contract'
      ? contractHtml(
          {
            ...shared,
            contractNumber: copy.number,
            contractTitle: copy.docTitle,
            expiresAt: null,
          },
          identity?.branding ?? null,
        )
      : invoiceHtml(
          {
            ...shared,
            invoiceNumber: copy.number,
            invoiceTitle: copy.docTitle,
            dueDate: null,
          },
          identity?.branding ?? null,
        )
  }, [kind, businessName, identity, copy])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      size="xl"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-text-muted">
          Sends the couple&apos;s most recent {kind} when this step runs, and turns on its share
          link if it is off. There is nothing to configure.
        </p>

        <div>
          <p className="mb-1.5 text-body font-medium text-text">Preview</p>
          <div className="overflow-hidden rounded-control border border-border">
            <div className="border-b border-border bg-surface-muted px-4 py-3">
              <p className="text-body text-text-subtle">Subject</p>
              {/* The exact subject the sender builds. */}
              <p className="text-body font-medium text-text">
                {kind === 'contract' ? 'Contract' : 'Invoice'} from {businessName} - {copy.number}
              </p>
            </div>
            {/* `srcDoc` binds directly: nothing here is typed, so the
                frame reloads only when the identity query lands. */}
            <iframe
              // `allow-same-origin` and nothing else: scripts, forms
              // and popups stay blocked.
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
              title={`${kind} email preview`}
              className="h-80 w-full bg-white"
            />
          </div>
          <p className="mt-1.5 text-body text-text-muted">
            Shown with a sample couple and {kind}.
          </p>
        </div>
      </div>
    </Modal>
  )
}
