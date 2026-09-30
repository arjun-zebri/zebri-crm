/**
 * Preview modal for the `send_contract`, `send_invoice` and
 * `send_proposal` steps.
 *
 * All three are zero-config: the handler picks the couple's most
 * recent contract, invoice or draft proposal and sends it as saved.
 * Every field their old schemas carried (`templateId`,
 * `signersRequired`, `expiryDays`, `customMessage`, the invoice's
 * payment fields) was declared and never read.
 *
 * So there is nothing to fill in, and the only question worth
 * answering is what the couple receives. Same treatment as the
 * questionnaire step: a preview built by the same pure builder the
 * sender calls, with a sample document standing in for the real one.
 *
 * @module app/(dashboard)/workflows/[id]/document-composer-modal
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { contractHtml, invoiceHtml, proposalHtml } from '@/lib/email/html'

import { loadSenderIdentityAction } from '../actions'

import { EmailPreview } from './email-preview'

/** Which document the step sends. */
export type DocumentKind = 'contract' | 'invoice' | 'proposal'

/** Stands in for the couple and document the run will be about. */
const SAMPLE_COUPLE = 'Sam & Alex'

interface Props {
  isOpen: boolean
  onClose: () => void
  kind: DocumentKind
}

const COPY: Record<
  DocumentKind,
  { title: string; number: string; docTitle: string; subject: string; what: string; note?: string }
> = {
  contract: {
    title: 'Send contract',
    number: 'CTR-001',
    docTitle: 'Wedding MC agreement',
    subject: 'Contract',
    what: 'most recent contract',
  },
  invoice: {
    title: 'Send invoice',
    number: 'INV-001',
    docTitle: 'Wedding MC services',
    subject: 'Invoice',
    what: 'most recent invoice',
  },
  proposal: {
    title: 'Send proposal',
    number: 'PR-001',
    docTitle: 'Wedding MC proposal',
    subject: 'A proposal',
    what: 'most recent draft proposal',
    note: "It sends the couple's draft only, so inside a workflow started by a proposal event (sent, opened, accepted, declined or expired) this step will skip.",
  },
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
    switch (kind) {
      case 'contract':
        return contractHtml(
          {
            ...shared,
            contractNumber: copy.number,
            contractTitle: copy.docTitle,
            expiresAt: null,
          },
          identity?.branding ?? null,
        )
      case 'invoice':
        return invoiceHtml(
          {
            ...shared,
            invoiceNumber: copy.number,
            invoiceTitle: copy.docTitle,
            dueDate: null,
          },
          identity?.branding ?? null,
        )
      case 'proposal':
        return proposalHtml(
          { ...shared, proposalNumber: copy.number, proposalTitle: copy.docTitle, expiresAt: null },
          identity?.branding ?? null,
        )
      default: {
        // A new DocumentKind must pick a template here, not render blank.
        const exhaustive: never = kind
        return exhaustive
      }
    }
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
          Sends the couple&apos;s {copy.what} when this step runs, and turns on its share link if
          it is off. There is nothing to configure.
          {copy.note ? ` ${copy.note}` : null}
        </p>

        <EmailPreview
          ready={identity !== undefined}
          subject={`${copy.subject} from ${businessName} - ${copy.number}`}
          html={previewHtml}
          frameTitle={`${kind} email preview`}
          caption={`Shown with a sample couple and ${kind}.`}
        />
      </div>
    </Modal>
  )
}
