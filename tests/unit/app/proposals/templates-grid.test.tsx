/**
 * The shared proposal templates grid: a grid of cards with a thumbnail,
 * default badge, and the three-step "New template" flow (founder's
 * ask, UX audit §3.8-3.9) - New template -> Start from scratch / Use a
 * template -> (gallery ->) name it -> created and opened in the editor.
 *
 * Renders `TemplatesGrid` directly with a minimal header (the shape both
 * its real hosts — the /proposals templates shortcut and the /templates
 * hub's Proposals tab — pass in) rather than through either host, since
 * this suite exercises the grid's own behaviour, not either host's chrome.
 *
 * @module tests/unit/app/proposals/templates-grid
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProposalTemplatesShortcut } from '@/app/(dashboard)/proposals/proposal-templates-shortcut'
import { TemplatesGrid } from '@/app/(dashboard)/proposals/templates/templates-grid'
import { ProposalTemplatesTab } from '@/app/(dashboard)/templates/proposal-templates-tab'
import { TemplatesActionsProvider } from '@/app/(dashboard)/templates/templates-actions-slot'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const actions = vi.hoisted(() => ({
  ensureDefaultTemplateAction: vi.fn(),
  listTemplatesAction: vi.fn(),
  createTemplateAction: vi.fn(),
  setDefaultTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
  duplicateTemplateAction: vi.fn(),
  updateTemplateSettingsAction: vi.fn(),
  getProposalSettingsAction: vi.fn(),
}))
// Every other barrel export (TEMPLATE_STARTERS, blankTemplateLayout,
// LayoutThumbnail, ...) stays real: TemplateCard, the New template modal
// chain and the gallery all import from this same barrel, and re-deriving
// their behaviour here (rather than exercising the real starter catalogue
// and thumbnail) would drift from what actually ships.
vi.mock('@/features/proposals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals')>()
  return { ...actual, ...actions }
})

const pushMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding: buildPublicBranding({ business_name: 'Sam MC' }), blocks: [], brandLabel: null, loading: false }),
}))

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: toastMock }) }))

// jsdom has no ResizeObserver; LayoutThumbnail observes its own box to
// compute a scale factor. Firing the callback isn't needed here - these
// tests never assert on thumbnail content, only on the flow around them.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const EMPTY_LAYOUT = { version: 2 as const, sections: [] }
const templates = [
  { id: 'a', name: 'My proposal', isDefault: true, updatedAt: '2026-09-16T00:00:00Z', layout: EMPTY_LAYOUT, settings: null },
  { id: 'b', name: 'Celebrant', isDefault: false, updatedAt: '2026-09-15T00:00:00Z', layout: EMPTY_LAYOUT, settings: null },
]
const ACCOUNT_SETTINGS = { password_enabled: false, allow_download: true, expiry_days: 14, deposit_percent: 30, link_preview: null }

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/** A minimal header, matching the shape either real host passes: just the "New template" opener. */
function renderGrid() {
  return renderWithClient(<TemplatesGrid header={(openNew) => <button onClick={openNew}>New template</button>} />)
}

describe('TemplatesGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: EMPTY_LAYOUT }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
  })

  it('ensures a default, then lists templates as cards with the default badge and an Open link to the editor route', async () => {
    renderGrid()
    expect(await screen.findByText('My proposal')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    const openLinks = screen.getAllByRole('link', { name: /open/i })
    expect(openLinks[0]).toHaveAttribute('href', `/proposals/templates/${templates[0]!.id}`)
    expect(openLinks[1]).toHaveAttribute('href', `/proposals/templates/${templates[1]!.id}`)
    expect(actions.ensureDefaultTemplateAction).toHaveBeenCalledTimes(1)
  })

  it('New template opens the Start from scratch / Use a starter design choice, not a direct create', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    expect(await screen.findByRole('button', { name: /start from scratch/i })).toBeInTheDocument()
    expect(actions.createTemplateAction).not.toHaveBeenCalled()
  })

  it('re-seeds the name field on every open, so a cancelled attempt never leaks into the next', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /start from scratch/i }))
    const first = await screen.findByLabelText('Template name')
    fireEvent.change(first, { target: { value: 'Draft two' } })
    fireEvent.keyDown(first, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('Template name')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /start from scratch/i }))
    expect(await screen.findByLabelText('Template name')).toHaveValue('Untitled template')
  })

  it('Start from scratch names a blank template, creates it and navigates to the editor', async () => {
    actions.createTemplateAction.mockResolvedValue({ ok: true, template: { id: 'new-id', name: 'Untitled template', isDefault: false, updatedAt: '2026-09-17T00:00:00Z', layout: EMPTY_LAYOUT } })
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /start from scratch/i }))
    const nameInput = await screen.findByLabelText('Template name')
    expect(nameInput).toHaveValue('Untitled template')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(actions.createTemplateAction).toHaveBeenCalledTimes(1))
    const call = actions.createTemplateAction.mock.calls[0]![0]
    expect(call.name).toBe('Untitled template')
    expect(call.layout.sections).toHaveLength(1)
    expect(call.layout.sections[0].kind).toBe('content')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/proposals/templates/new-id'))
  })

  it('Use a starter design opens the gallery; picking a starter carries its name into the name step', async () => {
    actions.createTemplateAction.mockResolvedValue({ ok: true, template: { id: 'new-id', name: 'Reception MC', isDefault: false, updatedAt: '2026-09-17T00:00:00Z', layout: EMPTY_LAYOUT } })
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /use a starter/i }))
    expect(await screen.findByText('Choose a template')).toBeInTheDocument()
    const useButton = screen.getByRole('button', { name: 'Use this template' })
    expect(useButton).toBeDisabled()
    const card = screen.getByRole('option', { name: /reception mc/i })
    // The card holds a real render of the layout (whose accept section
    // has a button), so the card itself must not be a <button>.
    expect(card.tagName).not.toBe('BUTTON')
    fireEvent.click(card)
    expect(useButton).not.toBeDisabled()
    fireEvent.click(useButton)
    const nameInput = await screen.findByLabelText('Template name')
    expect(nameInput).toHaveValue('Reception MC')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(actions.createTemplateAction).toHaveBeenCalledTimes(1))
    const call = actions.createTemplateAction.mock.calls[0]![0]
    expect(call.name).toBe('Reception MC')
    expect(call.layout.sections.length).toBeGreaterThan(1)
  })

  it('the gallery Back button returns to the Start from scratch / Use a starter design choice', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /use a starter/i }))
    await screen.findByText('Choose a template')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('button', { name: /start from scratch/i })).toBeInTheDocument()
  })

  it('offers no rename on the card: the name is plain text and the menu has no Rename', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    expect(screen.queryByRole('button', { name: 'Rename My proposal' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!)
    await screen.findByRole('button', { name: 'Edit' })
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
  })

  it('duplicates a template from the row menu and shows a toast', async () => {
    actions.duplicateTemplateAction.mockResolvedValue({ ok: true, template: { id: 'copy', name: 'My proposal copy', isDefault: false, updatedAt: '2026-09-17T00:00:00Z', layout: EMPTY_LAYOUT } })
    renderGrid()
    await screen.findByText('My proposal')
    const menus = screen.getAllByRole('button', { name: 'Row actions' })
    fireEvent.click(menus[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(actions.duplicateTemplateAction).toHaveBeenCalledWith({ id: 'a' }))
    expect(toastMock).toHaveBeenCalledWith('Template duplicated', 'success')
  })

  it('Edit in the row menu opens the template in the editor', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/proposals/templates/b'))
  })

  it('shows the section count in the caption', async () => {
    actions.listTemplatesAction.mockResolvedValue({
      ok: true,
      templates: [{ ...templates[0]!, layout: { version: 2 as const, sections: [{ id: 's1', kind: 'content', content: null }] } }],
    })
    renderGrid()
    expect(await screen.findByText(/1 section · Edited/)).toBeInTheDocument()
  })

  it('offers Delete on every template, default included, once more than one exists (deleting the default promotes another - deleteTemplateAction)', async () => {
    renderGrid()
    await screen.findByText('My proposal')
    const menus = screen.getAllByRole('button', { name: 'Row actions' })
    fireEvent.click(menus[0]!)
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument()
    fireEvent.click(menus[1]!)
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('Settings in the row menu opens a modal seeded from the account defaults, and saves a full snapshot for that template', async () => {
    actions.getProposalSettingsAction.mockResolvedValue({ ok: true, settings: ACCOUNT_SETTINGS })
    actions.updateTemplateSettingsAction.mockResolvedValue({ ok: true, settings: { ...ACCOUNT_SETTINGS, expiry_days: 30 } })
    renderGrid()
    await screen.findByText('Celebrant')
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: /Celebrant/ })
    const expiry = await screen.findByLabelText('Expiry (days)')
    expect(expiry).toHaveValue(14)
    fireEvent.change(expiry, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(actions.updateTemplateSettingsAction).toHaveBeenCalledWith({ id: 'b', settings: { ...ACCOUNT_SETTINGS, expiry_days: 30 } }),
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('a template with its own settings seeds the modal from them and can reset to the account defaults', async () => {
    actions.getProposalSettingsAction.mockResolvedValue({ ok: true, settings: ACCOUNT_SETTINGS })
    actions.listTemplatesAction.mockResolvedValue({
      ok: true,
      templates: [templates[0]!, { ...templates[1]!, settings: { ...ACCOUNT_SETTINGS, expiry_days: 60, password_enabled: true } }],
    })
    actions.updateTemplateSettingsAction.mockResolvedValue({ ok: true, settings: null })
    renderGrid()
    await screen.findByText('Celebrant')
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    expect(await screen.findByLabelText('Expiry (days)')).toHaveValue(60)
    fireEvent.click(screen.getByRole('button', { name: 'Reset to account defaults' }))
    await waitFor(() => expect(actions.updateTemplateSettingsAction).toHaveBeenCalledWith({ id: 'b', settings: null }))
  })

  it('a template on the account defaults does not offer a reset', async () => {
    actions.getProposalSettingsAction.mockResolvedValue({ ok: true, settings: ACCOUNT_SETTINGS })
    renderGrid()
    await screen.findByText('Celebrant')
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    await screen.findByLabelText('Expiry (days)')
    expect(screen.queryByRole('button', { name: 'Reset to account defaults' })).not.toBeInTheDocument()
  })

  it('shows a card-shaped skeleton grid, not a spinner, while the templates load', () => {
    actions.listTemplatesAction.mockReturnValue(new Promise(() => {}))
    renderGrid()
    const region = screen.getByRole('status', { name: 'Loading templates' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThanOrEqual(3)
    expect(region.querySelector('.animate-spin')).toBeNull()
  })

  it('shows an error toast when creating a template throws', async () => {
    actions.createTemplateAction.mockRejectedValue(new Error('network down'))
    renderGrid()
    await screen.findByText('My proposal')
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    fireEvent.click(await screen.findByRole('button', { name: /start from scratch/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('network down', 'error'))
  })
})

describe('ProposalTemplatesShortcut (the cards on /proposals)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: EMPTY_LAYOUT }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
  })

  it('offers the same row menu the hub does (Edit / Duplicate / Delete), not bare cards', async () => {
    // The first cut of the shortcut hand-rolled its own cards with no
    // menu, so a template could be opened from /proposals but not
    // duplicated or deleted without a detour through /templates.
    actions.duplicateTemplateAction.mockResolvedValue({ ok: true, template: { id: 'copy', name: 'Celebrant copy', isDefault: false, updatedAt: '2026-09-17T00:00:00Z', layout: EMPTY_LAYOUT } })
    renderWithClient(<ProposalTemplatesShortcut onNewTemplate={vi.fn()} />)
    await screen.findByText('Celebrant')
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[1]!)
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(actions.duplicateTemplateAction).toHaveBeenCalledWith({ id: 'b' }))
  })

  it('shows the outcomes line under each card without a "Sample data" pill', async () => {
    renderWithClient(<ProposalTemplatesShortcut onNewTemplate={vi.fn()} />)
    await screen.findByText('Celebrant')
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
  })

  it('shows the same card-shaped skeleton grid while loading', () => {
    actions.listTemplatesAction.mockReturnValue(new Promise(() => {}))
    renderWithClient(<ProposalTemplatesShortcut onNewTemplate={vi.fn()} />)
    const region = screen.getByRole('status', { name: 'Loading templates' })
    expect(region.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThanOrEqual(3)
    expect(region.querySelector('.animate-spin')).toBeNull()
  })

  it('with no templates, shows the page empty state with a New template button', async () => {
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates: [] })
    const onNewTemplate = vi.fn()
    renderWithClient(<ProposalTemplatesShortcut onNewTemplate={onNewTemplate} />)
    expect(await screen.findByText('No templates yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New template' }))
    expect(onNewTemplate).toHaveBeenCalledTimes(1)
  })
})

describe('ProposalTemplatesTab (the /templates hub)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.ensureDefaultTemplateAction.mockResolvedValue({ ok: true, template: { ...templates[0], layout: EMPTY_LAYOUT }, migratedFromV1: false })
    actions.listTemplatesAction.mockResolvedValue({ ok: true, templates })
  })

  it('shows the same grid with New template portaled into the hub action slot', async () => {
    // The sidebar's "Templates" led to a hub with no proposal templates on
    // it while a second "Templates" lived under Proposals (audit pass 2).
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    renderWithClient(<TemplatesActionsProvider slot={slot}><ProposalTemplatesTab /></TemplatesActionsProvider>)
    expect(await screen.findByText('My proposal')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Proposals' })).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'New template' })
    expect(slot.contains(button)).toBe(true)
    fireEvent.click(button)
    expect(await screen.findByRole('button', { name: /start from scratch/i })).toBeInTheDocument()
    slot.remove()
  })
})
