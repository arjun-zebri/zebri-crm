/**
 * The Templates tab (Phase 1): lists templates with the default badge,
 * creates one from the New button, and disables Open until the editor
 * ships in Phase 2.
 *
 * @module tests/unit/app/proposals/templates-list
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TemplatesList } from '@/app/(dashboard)/proposals/templates/templates-list'

const actions = vi.hoisted(() => ({
  ensureDefaultTemplateAction: vi.fn(),
  listTemplatesAction: vi.fn(),
  createTemplateAction: vi.fn(),
  setDefaultTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
  renameTemplateAction: vi.fn(),
}))
vi.mock('@/features/proposals', () => actions)

// A single hoisted mock, not `() => ({ toast: vi.fn() })`: that factory
// would hand back a fresh vi.fn() on every render (TemplatesList calls
// useToast() each render), so a test asserting on "the toast mock" would
// be asserting on a stale instance no render actually called.
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: toastMock }) }))

const templates = [
  { id: 'a', name: 'My proposal', isDefault: true, updatedAt: '2026-09-16T00:00:00Z' },
  { id: 'b', name: 'Celebrant', isDefault: false, updatedAt: '2026-09-15T00:00:00Z' },
]

// Same wrapper shape as tests/unit/app/calendar/booking-detail-panel.test.tsx:
// TemplatesList uses react-query, which throws without a provider ancestor.
function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('TemplatesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ensures a default, then lists templates with the default badge and an Open link to the editor route', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    renderWithClient(<TemplatesList />)
    expect(await screen.findByText('My proposal')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    const openLinks = screen.getAllByRole('link', { name: /open/i })
    expect(openLinks[0]).toHaveAttribute('href', `/proposals/templates/${templates[0]!.id}`)
    expect(openLinks[1]).toHaveAttribute('href', `/proposals/templates/${templates[1]!.id}`)
    expect(actions.ensureDefaultTemplateAction).toHaveBeenCalledTimes(1)
  })

  it('New template creates one and refreshes the list', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValueOnce({ ok: true, templates: [templates[0]] }).mockResolvedValueOnce({ ok: true, templates })
    actions.createTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[1], layout: { version: 2, sections: [] } } })
    renderWithClient(<TemplatesList />)
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    await waitFor(() => expect(actions.createTemplateAction).toHaveBeenCalledWith({ name: 'Untitled template', role: 'mc' }))
    expect(await screen.findByText('Celebrant')).toBeInTheDocument()
  })

  it('renames a template on blur', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    actions.renameTemplateAction.mockResolvedValue({ ok: true })
    renderWithClient(<TemplatesList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename My proposal' }))
    const input = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.blur(input)
    await waitFor(() => expect(actions.renameTemplateAction).toHaveBeenCalledWith({ id: 'a', name: 'New name' }))
  })

  it('Escape cancels a rename without calling the action', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    renderWithClient(<TemplatesList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename My proposal' }))
    const input = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(actions.renameTemplateAction).not.toHaveBeenCalled()
    expect(screen.getByText('My proposal')).toBeInTheDocument()
  })

  it('shows an error toast when a mutation throws', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates: [templates[0]] })
    actions.createTemplateAction.mockRejectedValue(new Error('network down'))
    renderWithClient(<TemplatesList />)
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('network down', 'error'))
  })

  it('a legitimate rename after an Escape-cancelled edit is not swallowed', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    actions.renameTemplateAction.mockResolvedValue({ ok: true })
    renderWithClient(<TemplatesList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename My proposal' }))
    const firstInput = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(firstInput, { target: { value: 'Discarded' } })
    fireEvent.keyDown(firstInput, { key: 'Escape' })
    // A second, real edit on the same row: the Escape above must not leave
    // the cancel guard armed for this new attempt.
    fireEvent.click(screen.getByRole('button', { name: 'Rename My proposal' }))
    const secondInput = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(secondInput, { target: { value: 'New name' } })
    fireEvent.blur(secondInput)
    await waitFor(() => expect(actions.renameTemplateAction).toHaveBeenCalledWith({ id: 'a', name: 'New name' }))
  })

  it('keeps the typed name on screen while a rename is in flight', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    // Never resolves: simulates the mutation still being in flight.
    actions.renameTemplateAction.mockReturnValue(new Promise(() => {}))
    renderWithClient(<TemplatesList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename My proposal' }))
    const input = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.blur(input)
    expect(screen.getByText('New name')).toBeInTheDocument()
    expect(screen.queryByText('My proposal')).not.toBeInTheDocument()
  })

  it('a rejected rename snaps the row back to the server name', async () => {
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: { version: 2, sections: [] } }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
    actions.renameTemplateAction.mockResolvedValue({ ok: false, error: 'Name already taken' })
    renderWithClient(<TemplatesList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename My proposal' }))
    const input = screen.getByLabelText('Template name for My proposal')
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.blur(input)
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Name already taken', 'error'))
    expect(screen.getByRole('button', { name: 'Rename My proposal' })).toBeInTheDocument()
    expect(screen.queryByText('New name')).not.toBeInTheDocument()
  })
})
