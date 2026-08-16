/**
 * The email composer modal.
 *
 * Two rules are worth pinning: recipients are chosen from one
 * multi-select and can never end up empty (an email with no role
 * silently sends to nobody), and a saved template is a starting point
 * that fills the fields, never a link the runner would follow instead
 * of the body the MC just edited.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { EmailComposerModal } from '@/app/(dashboard)/automations/[id]/email-composer-modal'

const TEMPLATE = {
  id: 't1',
  name: 'Welcome pack',
  subject: 'Welcome, {{couple.name}}',
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lovely to meet you' }] }],
  },
  category_id: null,
  archived_at: null,
  position: 0,
}

vi.mock('@/app/(dashboard)/templates/use-templates', () => ({
  useTemplates: () => ({ data: [TEMPLATE] }),
}))
vi.mock('@/app/(dashboard)/templates/use-categories', () => ({
  useCategories: () => ({ data: [] }),
}))

// The rich editor and the attachment list both reach for browser APIs
// and network; neither is what these tests are about. The editor stub
// reports the text it was handed so template loading is observable.
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({ value }: { value: unknown }) => (
    <div data-testid="body">{JSON.stringify(value)}</div>
  ),
}))
vi.mock('@/app/(dashboard)/templates/template-attachments', () => ({
  TemplateAttachments: () => <div data-testid="attachments" />,
}))

function open(config: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  render(
    <EmailComposerModal isOpen onClose={() => {}} config={config} onSave={onSave} />,
  )
  return onSave
}

/** Save and return the single draft the modal wrote back. */
function save(onSave: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  return onSave.mock.calls[0]![0] as Record<string, unknown>
}

beforeAll(() => {
  // Radix Select refuses to open in jsdom without these two.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.scrollIntoView = () => {}
})

describe('recipient multi-select', () => {
  it('summarises the selected roles on the trigger', () => {
    open({ recipients: { roles: ['primary', 'me'], fallback: 'primary_only' } })
    expect(screen.getByText('Primary couple email, Myself (your email)')).toBeInTheDocument()
  })

  it('adds a role without dropping the existing one', async () => {
    const onSave = open({ recipients: { roles: ['primary'], fallback: 'primary_only' } })
    fireEvent.click(screen.getByText('Primary couple email'))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Spouse' }))
    expect(save(onSave)['recipients']).toEqual({
      roles: ['primary', 'spouse'],
      fallback: 'primary_only',
    })
  })

  it('refuses to leave the list empty', async () => {
    const onSave = open({ recipients: { roles: ['spouse'], fallback: 'skip' } })
    fireEvent.click(screen.getByText('Spouse'))
    // Unticking the last role falls back to the primary email rather
    // than saving a step that would address nobody.
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Spouse' }))
    expect((save(onSave)['recipients'] as { roles: string[] }).roles).toEqual(['primary'])
  })
})

describe('lifting a pre-composer body', () => {
  it('turns its {{variables}} into mentions, not literal text', async () => {
    // The plain-text path renders mustache; the composer's path only
    // resolves mention nodes. Lifting the text verbatim would mail
    // "Hi {{couple.primary_name}}," to the couple — which is what the
    // action picker's own default body did.
    const onSave = open({ body: 'Hi {{couple.primary_name}},\n\n- {{mc.contact_name}}' })
    const body = JSON.parse(screen.getByTestId('body').textContent!) as {
      content: { content?: { type: string; attrs?: { id: string }; text?: string }[] }[]
    }
    const first = body.content[0]!.content!
    expect(first[0]).toEqual({ type: 'text', text: 'Hi ' })
    expect(first[1]).toEqual({ type: 'mention', attrs: { id: 'couple.primary_name' } })
    expect(first[2]).toEqual({ type: 'text', text: ',' })
    expect(save(onSave)['content']).toBeDefined()
  })

  it('lifts a copilot-written body, signature and all', () => {
    // The copilot writes plain strings and its system prompt tells it
    // to end with {{mc.signature}}, so this is the body most steps in
    // a generated automation actually carry.
    open({ body: 'Hi {{couple.name}},\n\nLovely to hear from you.\n\n{{mc.signature}}' })
    const body = JSON.parse(screen.getByTestId('body').textContent!) as {
      content: { content?: { type: string; attrs?: { id: string } }[] }[]
    }
    expect(body.content[0]!.content![1]).toEqual({
      type: 'mention',
      attrs: { id: 'couple.name' },
    })
    // A mention is what the editor paints as a green chip and what
    // the renderer resolves; as text it would be mailed verbatim.
    expect(body.content.at(-1)!.content![0]).toEqual({
      type: 'mention',
      attrs: { id: 'mc.signature' },
    })
  })

  it('tolerates spaces inside the braces', () => {
    open({ body: 'Hi {{ couple.name }}' })
    const body = JSON.parse(screen.getByTestId('body').textContent!) as {
      content: { content?: { type: string; attrs?: { id: string } }[] }[]
    }
    expect(body.content[0]!.content![1]).toEqual({
      type: 'mention',
      attrs: { id: 'couple.name' },
    })
  })

  it('keeps a filter on the expression', () => {
    open({ body: 'See you on {{event.date | friendly}}' })
    const body = JSON.parse(screen.getByTestId('body').textContent!) as {
      content: { content?: { type: string; attrs?: { id: string } }[] }[]
    }
    expect(body.content[0]!.content![1]).toEqual({
      type: 'mention',
      attrs: { id: 'event.date | friendly' },
    })
  })
})

describe('the CC field', () => {
  /** Open the CC dropdown and return its address input. */
  async function openCc() {
    fireEvent.click(screen.getAllByText('Nobody')[0]!)
    return screen.findByLabelText('Add a CC address')
  }

  it('takes several addresses, one per Enter', async () => {
    const onSave = open({ recipients: { roles: ['primary'], fallback: 'primary_only' } })
    const input = await openCc()
    fireEvent.change(input, { target: { value: 'planner@venue.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'second@venue.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(save(onSave)['ccEmails']).toEqual(['planner@venue.com', 'second@venue.com'])
  })

  it('splits a pasted list on the comma', async () => {
    const onSave = open({})
    const input = await openCc()
    fireEvent.change(input, { target: { value: 'a@b.com, c@d.com,' } })
    expect(save(onSave)['ccEmails']).toEqual(['a@b.com', 'c@d.com'])
  })

  it('drops a half-typed address rather than storing it', async () => {
    // The runner filters these too, but keeping them out of the config
    // means the chip summary never claims a recipient that isn't one.
    const onSave = open({})
    const input = await openCc()
    fireEvent.change(input, { target: { value: 'plann' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Nothing usable was entered, so the key is never written at all.
    expect(save(onSave)['ccEmails']).toBeUndefined()
  })

  it('keeps a typed address when focus moves away without Enter', async () => {
    // Typing then clicking the toggle (or anywhere else) must not
    // discard the address: there is no submit button in this popover,
    // so blur has to count as committing it.
    const onSave = open({})
    const input = await openCc()
    await userEvent.type(input, 'planner@venue.com')
    fireEvent.blur(input)
    expect(save(onSave)['ccEmails']).toEqual(['planner@venue.com'])
  })

  it('types character by character without losing the entry', async () => {
    const onSave = open({})
    const input = await openCc()
    await userEvent.type(input, 'planner@venue.com{Enter}')
    expect(save(onSave)['ccEmails']).toEqual(['planner@venue.com'])
  })

  it('removes one address without touching the rest', async () => {
    const onSave = open({ ccEmails: ['a@b.com', 'c@d.com'] })
    fireEvent.click(screen.getByText('a@b.com, c@d.com'))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove a@b.com' }))
    expect(save(onSave)['ccEmails']).toEqual(['c@d.com'])
  })

  it('carries the vendor toggle alongside the typed addresses', async () => {
    const onSave = open({ ccEmails: ['a@b.com'] })
    fireEvent.click(screen.getByText('a@b.com'))
    fireEvent.click(await screen.findByRole('checkbox', { name: "This couple's vendor contacts" }))
    const draft = save(onSave)
    expect(draft['ccVendors']).toBe(true)
    expect(draft['ccEmails']).toEqual(['a@b.com'])
  })
})

describe('starting from a template', () => {
  it('fills the subject and body instead of hiding them', async () => {
    const onSave = open({ subject: 'Old subject' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Start from a template' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Welcome pack' }))

    await waitFor(() =>
      expect(screen.getByDisplayValue('Welcome, {{couple.name}}')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('body')).toHaveTextContent('Lovely to meet you')
    // The picker keeps naming its choice rather than snapping back to
    // the placeholder.
    expect(screen.getByRole('combobox', { name: 'Start from a template' })).toHaveTextContent(
      'Welcome pack',
    )
    const draft = save(onSave)
    expect(draft['subject']).toBe('Welcome, {{couple.name}}')
    // No link left behind: the runner must send what the modal showed.
    expect(draft['templateId']).toBeUndefined()
    // …only a display-only note of where the words came from.
    expect(draft['sourceTemplateId']).toBe('t1')
  })

  it('materialises a config saved against a template, link and all', async () => {
    const onSave = open({ templateId: 't1' })
    await waitFor(() =>
      expect(screen.getByDisplayValue('Welcome, {{couple.name}}')).toBeInTheDocument(),
    )
    expect(save(onSave)['templateId']).toBeUndefined()
  })
})
