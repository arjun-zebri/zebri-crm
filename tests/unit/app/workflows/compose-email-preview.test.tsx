/**
 * The builder's Compose email preview (Task 28).
 *
 * The draft is rendered on the server by the send's own chain; this
 * pins what the modal sends there and how it labels the result. The
 * body must cross the server-action boundary as plain JSON: TipTap's
 * null-prototype attrs are silently dropped by it, which would turn a
 * variable into `{{null}}` in the preview.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComposeEmailPreview } from '@/app/(dashboard)/workflows/[id]/compose-email-preview'

const previewMock = vi.fn()

vi.mock('@/app/(dashboard)/workflows/preview-actions', () => ({
  previewComposeEmailAction: (input: unknown) => previewMock(input),
}))

/** A mention whose attrs have a null prototype, as TipTap's getJSON gives. */
function editorDoc() {
  const attrs = Object.assign(Object.create(null), { id: 'couple.name', label: null })
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'mention', attrs }] }],
  }
}

describe('ComposeEmailPreview', () => {
  beforeEach(() => {
    previewMock.mockReset()
  })

  it("renders the draft for the MC's couple and says so", async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: {
        subject: 'Hi Sam',
        html: '<html><body><p>Hi Sam</p></body></html>',
        unresolved: [],
        couple: { name: 'Sam & Priya', sample: false },
      },
    })
    render(<ComposeEmailPreview subject="Hi {{couple.name}}" content={editorDoc() as never} />)

    expect(await screen.findByTitle('Email preview')).toBeInTheDocument()
    expect(screen.getByText(/Shown as Sam & Priya would receive it/)).toBeInTheDocument()

    const input = previewMock.mock.calls[0]![0] as { subject: string; content: unknown }
    expect(input.subject).toBe('Hi {{couple.name}}')
    // Plain objects all the way down, so the mention id survives.
    const attrs = (input.content as { content: { content: { attrs: object }[] }[] }).content[0]!
      .content[0]!.attrs
    expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype)
    expect(attrs).toEqual({ id: 'couple.name', label: null })
  })

  it('labels a sample couple as a sample', async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: {
        subject: 'Hi',
        html: '<html><body></body></html>',
        unresolved: ['Venue'],
        couple: { name: 'Sam & Alex', sample: true },
      },
    })
    render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    expect(await screen.findByText(/Shown with a sample couple, Sam & Alex/)).toBeInTheDocument()
    expect(screen.getByText(/Venue is empty for Sam & Alex/)).toBeInTheDocument()
  })

  it('says when the preview could not be rendered', async () => {
    previewMock.mockResolvedValue({ ok: false, error: 'Too many previews. Try again in a minute.' })
    render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    await waitFor(() =>
      expect(screen.getByText(/Could not refresh the preview: Too many previews/)).toBeInTheDocument(),
    )
  })

  // Review I2: a render for an older draft never keeps the "Shown as"
  // label while the newer one is on its way.
  it('says it is updating while a newer draft renders', async () => {
    previewMock.mockResolvedValueOnce({
      ok: true,
      data: {
        subject: 'Hi',
        html: '<html><body></body></html>',
        unresolved: [],
        couple: { name: 'Sam & Priya', sample: false },
      },
    })
    const { rerender } = render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    expect(await screen.findByText(/Shown as Sam & Priya/)).toBeInTheDocument()

    previewMock.mockImplementation(() => new Promise(() => {}))
    rerender(<ComposeEmailPreview subject="Hi again" content={editorDoc() as never} />)
    expect(screen.getByText(/Updating the preview/)).toBeInTheDocument()
    expect(screen.queryByText(/Shown as Sam & Priya/)).toBeNull()
  })

  // Task 28 re-review (parked to the Phase 5 fix wave): a failure after a
  // good render left a dimmed frame and no way to force a retry.
  it('offers Try again over a dimmed earlier render when a refresh fails', async () => {
    const good = {
      ok: true,
      data: {
        subject: 'Hi',
        html: '<html><body></body></html>',
        unresolved: [],
        couple: { name: 'Sam & Priya', sample: false },
      },
    }
    previewMock.mockResolvedValueOnce(good)
    const { rerender } = render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    expect(await screen.findByText(/Shown as Sam & Priya/)).toBeInTheDocument()

    previewMock.mockResolvedValueOnce({ ok: false, error: 'Too many previews. Try again in a minute.' })
    rerender(<ComposeEmailPreview subject="Hi again" content={editorDoc() as never} />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    // The earlier render stays up, dimmed, under the error.
    expect(screen.getByTitle('Email preview')).toBeInTheDocument()

    previewMock.mockResolvedValueOnce({ ...good, data: { ...good.data, subject: 'Hi again' } })
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByText(/Shown as Sam & Priya/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  // Review M2: a first render that fails is an error with a way out,
  // not a skeleton that pulses forever.
  it('offers Try again when the first render fails, and retries', async () => {
    previewMock.mockResolvedValueOnce({ ok: false, error: 'Network down' })
    render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.queryByTitle('Email preview')).toBeNull()

    previewMock.mockResolvedValueOnce({
      ok: true,
      data: {
        subject: 'Hi',
        html: '<html><body></body></html>',
        unresolved: [],
        couple: { name: 'Sam & Priya', sample: false },
      },
    })
    fireEvent.click(retry)
    expect(await screen.findByTitle('Email preview')).toBeInTheDocument()
    expect(previewMock).toHaveBeenCalledTimes(2)
  })

  // Live check B8: a gap in the subject is marked, as in step detail.
  it('shows the subject with its gap marked', async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: {
        subject: 'Your day at [Venue name]',
        html: '<html><body></body></html>',
        unresolved: ['Venue name'],
        unknown: [],
        couple: { name: 'Sam & Priya', sample: false },
      },
    })
    render(<ComposeEmailPreview subject="Your day at {{venue.name}}" content={editorDoc() as never} />)
    expect(await screen.findByText('Your day at [Venue name]')).toBeInTheDocument()
  })

  // Live check B7: an unknown variable is not "empty for" the couple.
  it('names a variable Zebri does not know, without blaming the couple', async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: {
        subject: 'Hi',
        html: '<html><body></body></html>',
        unresolved: [],
        unknown: ['event.venue'],
        couple: { name: 'Sam & Priya', sample: false },
      },
    })
    render(<ComposeEmailPreview subject="Hi" content={editorDoc() as never} />)
    const line = await screen.findByText(/not a variable Zebri knows/)
    expect(line).toHaveTextContent('{{event.venue}}')
    expect(screen.queryByText(/is empty for/)).toBeNull()
  })
})
