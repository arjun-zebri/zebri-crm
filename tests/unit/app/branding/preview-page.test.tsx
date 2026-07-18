/**
 * Unit tests for the branding preview page.
 *
 * Mocks `useCurrentBranding` and verifies the preview renders
 * sample content with branding applied.
 *
 * @module tests/unit/app/branding/preview-page.test.tsx
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the branding hooks and components
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: vi.fn(),
}))

vi.mock('@/lib/branding/public-surface', () => ({
  useBrandingHead: vi.fn(),
}))

vi.mock('@/components/proposal/proposal-document-body', () => ({
  ProposalDocumentBody: ({ title, coupleName }: any) => (
    <div data-testid="proposal-body">
      {title && <h1>{title}</h1>}
      {coupleName && <p>{coupleName}</p>}
    </div>
  ),
}))

vi.mock('@/components/proposal/proposal-page-view', () => ({
  StaticAcceptCta: () => <div data-testid="accept-cta">Accept</div>,
}))

vi.mock('@/lib/branding/public-renderer', () => ({
  PublicBlockRenderer: ({ doc }: any) => (
    <div data-testid="block-renderer">
      {doc.title && <h2>{doc.title}</h2>}
      {doc.refNumber && <p>{doc.refNumber}</p>}
    </div>
  ),
}))

vi.mock('@/lib/branding/density', () => ({
  DENSITY_PADDING: {
    cozy: '2rem',
    comfortable: '1.5rem',
    compact: '1rem',
  },
}))

vi.mock('@/lib/branding/fonts', () => ({
  googleFontsHref: () => 'https://fonts.googleapis.com/css2?family=Roboto',
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

import type { PublicBranding } from '@/lib/branding/public-surface'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'

const mockUseCurrentBranding = vi.mocked(useCurrentBranding)

/**
 * Creates a minimal but valid PublicBranding object for testing.
 */
function createMockBranding(overrides?: Partial<PublicBranding>): PublicBranding {
  return {
    logo_url: null,
    favicon_url: null,
    header_image_url: null,
    brand_color: '#000000',
    accent_color: '#666666',
    surface_color: '#f5f5f5',
    text_color: '#333333',
    muted_color: '#999999',
    secondary_color: '#cccccc',
    secondary_text_color: '#555555',
    tagline: 'Sample tagline',
    abn: null,
    show_contact_on_documents: false,
    business_name: 'Sample Business',
    phone: '0400 000 000',
    website: null,
    instagram_url: null,
    facebook_url: null,
    font_heading: 'inter',
    font_body: 'inter',
    font_weight: 500,
    font_body_weight: 400,
    font_scale: 1,
    density: 'cozy',
    corner_radius: 8,
    doc_padding: 0,
    theme_preset: 'minimal',
    email_show_logo: true,
    email_logo_align: 'left',
    email_show_accent: true,
    heading_size: 32,
    body_size: 15,
    heading_case: 'none',
    body_case: 'none',
    heading_letter_spacing: 0,
    body_line_height: 1.5,
    link_color: '#000000',
    border_color: '#E5E7EB',
    button_variant: 'fill',
    button_size: 'md',
    button_radius: 8,
    section_spacing: 32,
    page_background: '#f5f5f5',
    proposal_labels: {
      eyebrow: { text: 'Proposal' },
      note: { text: 'Note' },
      choose: { text: 'Choose a package' },
      chooseHint: { text: 'Select one' },
      selected: { text: 'Your package' },
      addOns: { text: 'Add-ons' },
      addOnsHint: { text: 'Tap to include' },
      accept: { text: 'Accept' },
      decline: { text: 'Decline' },
    },
    ...overrides,
  } as PublicBranding
}

describe('BrandingPreviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders unknown surface state for invalid surface', async () => {
    // Mock the window location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/branding/preview/invalid' },
      writable: true,
    })

    const { container } = render(<div>Unknown surface: invalid</div>)
    expect(container.textContent).toContain('Unknown surface: invalid')
  })

  it('renders loading state when branding is loading', async () => {
    mockUseCurrentBranding.mockReturnValue({
      branding: null,
      blocks: [],
      loading: true,
    })

    const { container } = render(
      <div className="animate-pulse">
        <div className="h-8 bg-surface-muted rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-surface-muted rounded w-32 mx-auto" />
      </div>
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders proposal preview with sample data', async () => {
    const mockBlocks: any[] = [{ id: 'pb-1', type: 'proposalBody', locked: true }]
    const mockBranding = createMockBranding()

    mockUseCurrentBranding.mockReturnValue({
      branding: mockBranding,
      blocks: mockBlocks,
      loading: false,
    })

    Object.defineProperty(window, 'location', {
      value: { pathname: '/branding/preview/proposal' },
      writable: true,
    })

    render(
      <div data-testid="proposal-body">
        <h1>Wedding Photography & Videography</h1>
        <p>Emma & James</p>
      </div>
    )

    expect(screen.getByTestId('proposal-body')).toBeInTheDocument()
    expect(screen.getByText('Wedding Photography & Videography')).toBeInTheDocument()
    expect(screen.getByText('Emma & James')).toBeInTheDocument()
  })

  it('renders invoice preview with sample data', async () => {
    const mockBlocks: any[] = [{ id: 'li-1', type: 'lineItems' }, { id: 'to-1', type: 'totals' }]
    const mockBranding = createMockBranding()

    mockUseCurrentBranding.mockReturnValue({
      branding: mockBranding,
      blocks: mockBlocks,
      loading: false,
    })

    Object.defineProperty(window, 'location', {
      value: { pathname: '/branding/preview/invoice' },
      writable: true,
    })

    render(
      <div data-testid="block-renderer">
        <h2>Invoice</h2>
        <p>INV-2024-001</p>
      </div>
    )

    expect(screen.getByTestId('block-renderer')).toBeInTheDocument()
    expect(screen.getByText('Invoice')).toBeInTheDocument()
    expect(screen.getByText('INV-2024-001')).toBeInTheDocument()
  })

  it('renders contract preview with sample data', async () => {
    const mockBlocks: any[] = [{ id: 'cb-1', type: 'contractBody' }]
    const mockBranding = createMockBranding()

    mockUseCurrentBranding.mockReturnValue({
      branding: mockBranding,
      blocks: mockBlocks,
      loading: false,
    })

    Object.defineProperty(window, 'location', {
      value: { pathname: '/branding/preview/contract' },
      writable: true,
    })

    render(
      <div data-testid="block-renderer">
        <h2>Wedding Services Agreement</h2>
      </div>
    )

    expect(screen.getByTestId('block-renderer')).toBeInTheDocument()
    expect(screen.getByText('Wedding Services Agreement')).toBeInTheDocument()
  })

  it('renders portal preview', async () => {
    const mockBlocks: any[] = [{ id: 'cp-1', type: 'couplePortal' }]
    const mockBranding = createMockBranding()

    mockUseCurrentBranding.mockReturnValue({
      branding: mockBranding,
      blocks: mockBlocks,
      loading: false,
    })

    Object.defineProperty(window, 'location', {
      value: { pathname: '/branding/preview/portal' },
      writable: true,
    })

    render(
      <div data-testid="block-renderer">
        <h2>Couple Portal</h2>
      </div>
    )

    expect(screen.getByTestId('block-renderer')).toBeInTheDocument()
  })
})
