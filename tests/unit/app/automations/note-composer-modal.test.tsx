/**
 * The add-note composer.
 *
 * The note is plain text (the handler appends it to a text column),
 * so variables are inserted rather than typed as mention nodes. What
 * matters here is that a token lands where the caret was, not
 * wherever the field happened to be scrolled to, and that a step can
 * never be saved without the text its runner requires.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NoteComposerModal } from '@/app/(dashboard)/automations/[id]/note-composer-modal'

function open(config: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  render(<NoteComposerModal isOpen onClose={() => {}} config={config} onSave={onSave} />)
  return onSave
}

/** The note field, by its label. */
function field() {
  return screen.getByLabelText('Note') as HTMLTextAreaElement
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('the note composer', () => {
  it('hydrates from the saved config and writes the text back', () => {
    const onSave = open({ text: 'Called the venue' })
    expect(field()).toHaveValue('Called the venue')
    fireEvent.change(field(), { target: { value: 'Called the venue twice' } })
    save()
    expect(onSave.mock.calls[0]![0]).toMatchObject({ text: 'Called the venue twice' })
  })

  it('refuses to save an empty note', () => {
    // `add_note`'s schema requires the text, so an empty one is a step
    // that fails on its first run.
    const onSave = open({})
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(field(), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('inserts a variable at the caret, not at the end', async () => {
    const onSave = open({ text: 'Hi , welcome' })
    const input = field()
    // Caret between "Hi " and the comma.
    input.setSelectionRange(3, 3)
    fireEvent.select(input)

    fireEvent.click(screen.getByRole('button', { name: /Insert variable/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Primary contact/ }))

    save()
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      text: 'Hi {{couple.primary_name}}, welcome',
    })
  })

  it('appends when nothing has been focused yet', () => {
    const onSave = open({ text: 'Note from' })
    fireEvent.click(screen.getByRole('button', { name: /Insert variable/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Your name/ }))
    save()
    expect(onSave.mock.calls[0]![0]).toMatchObject({ text: 'Note from{{mc.contact_name}}' })
  })

  it('groups the variables the way the catalogue does', () => {
    open({ text: 'x' })
    fireEvent.click(screen.getByRole('button', { name: /Insert variable/ }))
    expect(screen.getByText('Couple')).toBeInTheDocument()
    expect(screen.getByText('You (MC)')).toBeInTheDocument()
  })
})
