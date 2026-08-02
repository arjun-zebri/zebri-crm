/**
 * Unit tests for the invoice builder's first-paint skeleton gate.
 *
 * The modal used to gate its skeleton on the invoice row alone, so on a
 * new invoice it showed no skeleton at all and the form appeared
 * instantly, then reflowed as the packages picker, the couple list, and
 * the branded preview each landed. These tests pin the wider gate: the
 * form body stays behind the skeleton until every first-paint input is
 * ready, and one slow input is enough to hold it.
 *
 * The preview pane and the payment-schedule hook are stubbed — neither is
 * under test here and both are heavy in jsdom.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(dashboard)/payments/actions', () => ({
  saveInvoiceAction: vi.fn(),
  deleteInvoiceAction: vi.fn(),
}));

vi.mock('@/components/builders/parts/builder-preview-pane', () => ({
  BuilderPreviewPane: () => <div data-testid="preview-pane" />,
}));

vi.mock('@/components/builders/parts/use-invoice-stages', () => ({
  useInvoiceStages: () => ({
    stages: [],
    schedules: [],
    schedulesLoading: false,
    schedulesError: null,
    defaultSchedule: null,
    validationError: null,
    markPendingStageId: null,
    setStages: vi.fn(),
    applyTemplate: vi.fn(),
    markPaid: vi.fn(),
    createSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    setDefaultSchedule: vi.fn(),
    persist: vi.fn(),
  }),
}));

const applySources = vi.fn();
vi.mock('@/components/builders/parts/use-apply-sources', () => ({
  useApplySources: () => applySources(),
}));

const currentBranding = vi.fn();
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => currentBranding(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: 'u1', app_metadata: {}, user_metadata: {} } },
        }),
    },
    from: (table: string) => {
      const rows =
        table === 'couples'
          ? [{ id: '11111111-1111-4111-9111-111111111111', name: 'Amy & Ben' }]
          : [];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      };
      for (const method of ['select', 'eq', 'order', 'is', 'not', 'update']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.single = () => Promise.resolve({ data: null, error: null });
      return chain;
    },
  }),
}));

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { InvoiceBuilderModal } = await import(
  '@/components/builders/invoice-builder-modal'
);

const READY_SOURCES = { data: { options: [], applyMap: {} }, isPending: false };
const PENDING_SOURCES = { data: undefined, isPending: true };
const READY_BRANDING = { branding: {}, blocks: [], brandLabel: null, loading: false };
const PENDING_BRANDING = { branding: null, blocks: [], brandLabel: null, loading: true };

function renderNewInvoice() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoiceBuilderModal invoiceId="new" isOpen onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

/** The form body renders a Notes field; the skeleton does not. */
const formBody = () => screen.queryByText('Notes');

beforeEach(() => {
  applySources.mockReset();
  currentBranding.mockReset();
});

describe('invoice builder first-paint skeleton', () => {
  it('holds the skeleton while branding is still loading', async () => {
    applySources.mockReturnValue(READY_SOURCES);
    currentBranding.mockReturnValue(PENDING_BRANDING);
    renderNewInvoice();
    // Give the couples query a tick to settle so branding is the only
    // outstanding input.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(formBody()).toBeNull();
    expect(screen.queryByTestId('preview-pane')).toBeNull();
  });

  it('holds the skeleton while the packages/templates list is still loading', async () => {
    applySources.mockReturnValue(PENDING_SOURCES);
    currentBranding.mockReturnValue(READY_BRANDING);
    renderNewInvoice();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(formBody()).toBeNull();
  });

  it('reveals the form and the preview once every input is ready', async () => {
    applySources.mockReturnValue(READY_SOURCES);
    currentBranding.mockReturnValue(READY_BRANDING);
    renderNewInvoice();
    await waitFor(() => expect(formBody()).toBeInTheDocument());
    expect(screen.getByTestId('preview-pane')).toBeInTheDocument();
  });
});
