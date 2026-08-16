/**
 * The questionnaire step's preview modal.
 *
 * This step's email is canned, so the modal exists to answer "what
 * does the couple receive?". The thing worth pinning is that the
 * preview comes from `questionnaireHtml` — the same pure builder the
 * sender calls — so it cannot drift from what is actually sent, and
 * that the title shown matches the handler's own fallback.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { QuestionnaireComposerModal } from '@/app/(dashboard)/automations/[id]/questionnaire-composer-modal'

vi.mock('@/app/(dashboard)/automations/[id]/filter-options', () => ({
  useQuestionnaireTemplateOptions: () => [
    { value: 'q1', label: 'Ceremony details' },
    { value: 'q2', label: 'Music preferences' },
  ],
}))

vi.mock('@/app/(dashboard)/automations/actions', () => ({
  loadSenderIdentityAction: async () => ({
    businessName: 'Acme MC Co',
    contactName: 'Charlie Park',
    email: 'charlie@acmemc.com',
    branding: null,
  }),
}))

function renderModal(config: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(
    <Wrapper>
      <QuestionnaireComposerModal isOpen onClose={() => {}} config={config} onSave={onSave} />
    </Wrapper>,
  )
  return onSave
}

/**
 * The markup currently in the preview.
 *
 * `srcDoc` is set once and the document is patched in place after
 * that (swapping it would reload the iframe on every keystroke), so
 * the live document is what to read — falling back to `srcdoc` before
 * the first load fires.
 */
function previewHtml(): string {
  const frame = screen.getByTitle('Questionnaire email preview') as HTMLIFrameElement
  return frame.contentDocument?.documentElement.innerHTML || frame.srcdoc
}

function previewFrame() {
  return screen.getByTitle('Questionnaire email preview') as HTMLIFrameElement
}

/**
 * Wait for the identity query and the iframe's own load to land.
 *
 * Both update state after the render settles, so a test that ends
 * before them reports their renders as un-acted.
 */
async function settled() {
  await waitFor(() => expect(previewHtml()).toContain('Acme MC Co'))
  // One more macrotask: jsdom fires the iframe's load event on a
  // later turn than the query resolves, and its state update lands
  // after the assertion above.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('the questionnaire preview modal', () => {
  it('shows the subject the sender actually builds', async () => {
    // `sendQuestionnaireEmail` sends "<business> sent you a few
    // questions", with the MC's real name.
    renderModal({ questionnaireTemplateId: 'q1' })
    await waitFor(() =>
      expect(screen.getByText('Acme MC Co sent you a few questions')).toBeInTheDocument(),
    )
  })

  it('previews the questionnaire body, link and all', async () => {
    renderModal({ questionnaireTemplateId: 'q1' })
    // The MC's real name arrives with the identity query, so wait on
    // that rather than on markup that is there from the first render.
    await waitFor(() => expect(previewHtml()).toContain('Acme MC Co'))
    expect(previewHtml()).toContain('Start questionnaire')
    expect(previewHtml()).toContain('/questionnaire/')
  })

  it('falls back to the template name, the way the handler does', async () => {
    // An empty title override sends the template's own name, so the
    // preview must not show a blank heading.
    renderModal({ questionnaireTemplateId: 'q1' })
    await waitFor(() => expect(previewHtml()).toContain('Ceremony details'))
  })

  it('shows a title override in place of the template name', async () => {
    renderModal({ questionnaireTemplateId: 'q1', title: 'A few quick questions' })
    await waitFor(() => expect(previewHtml()).toContain('A few quick questions'))
  })

  it('refuses to save without a questionnaire', () => {
    // The runner requires the template id, so an empty one is a step
    // that fails on its first run.
    renderModal({})
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('never swaps srcDoc, so typing a title does not reload the frame', async () => {
    // A reload per keystroke is the flash: the document is loaded once
    // and patched in place after that.
    renderModal({ questionnaireTemplateId: 'q1' })
    await waitFor(() => expect(previewHtml()).toContain('Acme MC Co'))
    const initial = previewFrame().srcdoc

    fireEvent.change(screen.getByLabelText('Title (optional)'), {
      target: { value: 'A few quick questions' },
    })

    await waitFor(() => expect(previewHtml()).toContain('A few quick questions'))
    expect(previewFrame().srcdoc).toBe(initial)
  })

  it('sandboxes the preview, but keeps it same-origin', async () => {
    // Scripts and forms stay blocked. `allow-same-origin` is what
    // lets the parent patch the document; a bare `sandbox=""` is an
    // opaque origin, where `contentDocument` is null in a real
    // browser and the preview silently stops updating. jsdom does not
    // enforce that, which is why this needs saying here.
    renderModal({ questionnaireTemplateId: 'q1' })
    const sandbox = previewFrame().getAttribute('sandbox') ?? ''
    expect(sandbox.split(' ')).toEqual(['allow-same-origin'])
    await settled()
  })
})
