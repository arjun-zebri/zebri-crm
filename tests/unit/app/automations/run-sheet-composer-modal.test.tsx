/**
 * The run sheet step's compose modal.
 *
 * The whole email belongs to the handler — subject, shell, message
 * and link — so the only decision here is who receives it. What is
 * worth pinning: the preview is built the way the handler builds it,
 * the audiences are independent (picking one must not clear the
 * others), and a step saved with its own message still previews that
 * rather than the default it no longer uses.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RunSheetComposerModal } from '@/app/(dashboard)/automations/[id]/run-sheet-composer-modal'

vi.mock('@/app/(dashboard)/automations/actions', () => ({
  loadSenderIdentityAction: async () => ({ businessName: 'Acme MC Co', branding: null }),
}))

function renderModal(config: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <Wrapper>
      <RunSheetComposerModal isOpen onClose={() => {}} config={config} onSave={onSave} />
    </Wrapper>,
  )
  return onSave
}

/** The preview markup. Bound straight to srcDoc: nothing is typed. */
function previewHtml(): string {
  return (screen.getByTitle('Run sheet email preview') as HTMLIFrameElement).srcdoc
}

/** Open the send-to popover and return its rows. */
async function openAudiences() {
  fireEvent.click(screen.getByRole('button', { name: /send to/ }))
  return screen.findAllByRole('menuitemcheckbox')
}

describe('the run sheet composer', () => {
  it('shows the subject the handler builds', async () => {
    renderModal({})
    await waitFor(() =>
      expect(screen.getByText(/Run sheet for Sam & Alex - Acme MC Co/)).toBeInTheDocument(),
    )
  })

  it('previews the canned message and the link, in the handler\'s shell', async () => {
    renderModal({})
    await waitFor(() => expect(previewHtml()).toContain('Acme MC Co'))
    // The default copy, with its variables filled in.
    expect(previewHtml()).toContain('Here is the latest timeline for Sam &amp; Alex')
    expect(previewHtml()).not.toContain('{{couple.name}}')
    expect(previewHtml()).toContain('/timeline/')
    // `wrapAutomationShell`'s footer: the same builder the handler
    // calls, so the preview cannot drift from the send.
    expect(previewHtml()).toContain('via Zebri')
  })

  it('offers no way to write a message', () => {
    // The subject, shell and link were always fixed; a one-line
    // message that had to be typed on every step was a field asking
    // to be left as its default.
    renderModal({})
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument()
  })

  it('still previews a message saved before the field went away', async () => {
    renderModal({ message: 'Run sheet attached, thanks all.' })
    await waitFor(() => expect(previewHtml()).toContain('Run sheet attached, thanks all.'))
  })

  it('lets the audiences be picked independently', async () => {
    // Three flags on the handler, not one choice: ticking "Me" must
    // not untick the vendors.
    const onSave = renderModal({ sendToVendors: true })
    const rows = await openAudiences()
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Me' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave.mock.calls[0]![0]).toMatchObject({ sendToVendors: true, sendToMe: true })
  })

  it('can turn every audience off, and says so', async () => {
    const onSave = renderModal({ sendToVendors: true })
    fireEvent.click((await openAudiences())[0]!)
    expect(screen.getByRole('button', { name: /send to nobody/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave.mock.calls[0]![0]).toMatchObject({ sendToVendors: false })
  })
})
