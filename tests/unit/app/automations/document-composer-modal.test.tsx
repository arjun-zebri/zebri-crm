/**
 * The contract / invoice preview modal.
 *
 * Both steps are zero-config — the handler sends the couple's most
 * recent document as saved — so the modal exists to answer what the
 * couple receives. What is worth pinning: the preview comes from the
 * same pure builders the senders call, and the subject matches the
 * one the sender writes.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  DocumentComposerModal,
  type DocumentKind,
} from '@/app/(dashboard)/automations/[id]/document-composer-modal'

vi.mock('@/app/(dashboard)/automations/actions', () => ({
  loadSenderIdentityAction: async () => ({
    businessName: 'Acme MC Co',
    contactName: 'Charlie Park',
    email: 'charlie@acmemc.com',
    branding: null,
  }),
}))

function renderModal(kind: DocumentKind) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <Wrapper>
      <DocumentComposerModal isOpen onClose={() => {}} kind={kind} />
    </Wrapper>,
  )
}

function previewHtml(kind: DocumentKind): string {
  return (screen.getByTitle(`${kind} email preview`) as HTMLIFrameElement).srcdoc
}

describe('the document preview modal', () => {
  it('shows the subject the contract sender builds', async () => {
    renderModal('contract')
    await waitFor(() =>
      expect(screen.getByText('Contract from Acme MC Co - CTR-001')).toBeInTheDocument(),
    )
  })

  it('shows the subject the invoice sender builds', async () => {
    renderModal('invoice')
    await waitFor(() =>
      expect(screen.getByText('Invoice from Acme MC Co - INV-001')).toBeInTheDocument(),
    )
  })

  it('previews the contract email, link and all', async () => {
    renderModal('contract')
    await waitFor(() => expect(previewHtml('contract')).toContain('Acme MC Co'))
    expect(previewHtml('contract')).toContain('/contract/')
  })

  it('previews the invoice email, link and all', async () => {
    renderModal('invoice')
    await waitFor(() => expect(previewHtml('invoice')).toContain('Acme MC Co'))
    expect(previewHtml('invoice')).toContain('/invoice/')
  })

  it('says plainly that there is nothing to configure', async () => {
    // Every field these schemas carried was declared and never read,
    // so a form here would be a form that changes nothing.
    renderModal('invoice')
    expect(screen.getByText(/nothing to configure/)).toBeInTheDocument()
    await waitFor(() => expect(previewHtml('invoice')).toContain('Acme MC Co'))
  })

  it('sandboxes the preview, but keeps it same-origin', async () => {
    renderModal('contract')
    const frame = screen.getByTitle('contract email preview')
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin')
    await waitFor(() => expect(previewHtml('contract')).toContain('Acme MC Co'))
  })
})
