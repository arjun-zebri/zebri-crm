/**
 * The add-note composer.
 *
 * The note is stored as a plain mustache string (the handler appends
 * it to a text column) but written in the mention-bearing editor, so
 * what matters here is the seam: a saved note opens with its
 * variables as chips, and what is saved is the flattened string the
 * runner can render.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NoteComposerModal } from '@/app/(dashboard)/automations/[id]/note-composer-modal'
import { textToDoc } from '@/lib/automations/mustache-doc'

const editorProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

// The real editor is TipTap: it needs a DOM range API jsdom does not
// have, and its own behaviour has its own tests. This stub records
// what it was handed and lets a test drive `onChange`.
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: (props: Record<string, unknown>) => {
    editorProps.current = props
    return <div data-testid="editor">{JSON.stringify(props['value'])}</div>
  },
}))

function open(config: Record<string, unknown> = {}) {
  const onSave = vi.fn()
  render(<NoteComposerModal isOpen onClose={() => {}} config={config} onSave={onSave} />)
  return onSave
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('the note composer', () => {
  it('opens a saved note with its variables as mentions, not braces', () => {
    // Text in braces is inert in the editor — it would render as
    // literal `{{…}}` instead of a green chip.
    open({ text: 'Hi {{couple.primary_name}}' })
    const value = JSON.parse(screen.getByTestId('editor').textContent!)
    expect(value.content[0].content[1]).toEqual({
      type: 'mention',
      attrs: { id: 'couple.primary_name' },
    })
  })

  it('saves the flattened string the runner stores', () => {
    const onSave = open({ text: 'old' })
    const onChange = editorProps.current!['onChange'] as (doc: unknown) => void
    act(() => onChange(textToDoc('Called {{venue.name}} today')))
    save()
    expect(onSave.mock.calls[0]![0]).toMatchObject({ text: 'Called {{venue.name}} today' })
  })

  it('keeps the rest of the step config', () => {
    const onSave = open({ text: 'a', someOtherKey: 1 })
    save()
    expect(onSave.mock.calls[0]![0]).toMatchObject({ someOtherKey: 1 })
  })

  it('refuses to save an empty note', () => {
    // `add_note`'s schema requires the text, so an empty one is a step
    // that fails on its first run.
    const onSave = open({})
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('offers the variables and prompts for @, with no label above the field', () => {
    open({})
    expect(editorProps.current!['variables']).toBeTruthy()
    expect(String(editorProps.current!['placeholder'])).toContain('@')
    // The modal title already names it; a lone field needs no second
    // name above it.
    expect(screen.queryByText('Note')).not.toBeInTheDocument()
  })
})
