/**
 * Unit tests for the hero's embed-link popover, which replaced the toolbar's
 * always-visible Embed URL field: invalid links toast and change nothing,
 * valid ones are handed to the caller, and cancelling never touches the
 * current media.
 *
 * @module tests/unit/app/branding/blocks/embed-url-popover
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedUrlPopover } from '@/app/(dashboard)/branding/blocks/proposal/embed-url-popover'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Embed video' }))
  return screen.getByRole('textbox', { name: 'Video link' })
}

describe('EmbedUrlPopover', () => {
  beforeEach(() => toastMock.mockClear())

  it('rejects a non YouTube/Vimeo link with a toast and no submit', () => {
    const onSubmit = vi.fn()
    render(<EmbedUrlPopover onSubmit={onSubmit} trigger={<button type="button">Embed video</button>} />)
    const input = open()
    fireEvent.change(input, { target: { value: 'https://example.com/video' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use video' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('Only YouTube and Vimeo links can be embedded', 'error')
  })

  it('submits a valid Vimeo link and closes', () => {
    const onSubmit = vi.fn()
    render(<EmbedUrlPopover onSubmit={onSubmit} trigger={<button type="button">Embed video</button>} />)
    const input = open()
    fireEvent.change(input, { target: { value: 'https://vimeo.com/123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use video' }))
    expect(onSubmit).toHaveBeenCalledWith('https://vimeo.com/123456789')
    expect(screen.queryByRole('textbox', { name: 'Video link' })).toBeNull()
  })

  it('seeds the field with the current embed and cancelling submits nothing', () => {
    const onSubmit = vi.fn()
    render(<EmbedUrlPopover value="https://youtu.be/dQw4w9WgXcQ" onSubmit={onSubmit} trigger={<button type="button">Embed video</button>} />)
    const input = open()
    expect(input).toHaveValue('https://youtu.be/dQw4w9WgXcQ')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
