/**
 * Unit tests for the invoice builder adopting the id of an invoice first
 * saved from the "new" state.
 *
 * The couple profile creates the invoice row up front and opens the modal
 * on a real id, so the share link, Open, and "Mark as sent" controls are
 * there immediately. `/payments` opens the same modal with `invoiceId`
 * fixed at `'new'`, so before this fix the modal never learned the id its
 * own save had just created: the detail query stayed disabled, `shareUrl`
 * stayed null, and the whole left half of the footer never rendered. A
 * second Save even inserted a duplicate invoice, because the save input
 * still carried a null id.
 *
 * These tests pin the adoption: after the first save the footer's share
 * controls appear, and subsequent saves target the row that was created.
 *
 * The preview pane and the payment-schedule hook are stubbed — neither is
 * under test here and both are heavy in jsdom.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const COUPLE_ID = '11111111-1111-4111-9111-111111111111';
const INVOICE_ID = '22222222-2222-4222-9222-222222222222';
const SHARE_TOKEN = 'tok_share_123';

const saveInvoiceAction = vi.fn();
vi.mock('@/app/(dashboard)/payments/actions', () => ({
  saveInvoiceAction: (input: unknown) => saveInvoiceAction(input),
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

vi.mock('@/components/builders/parts/use-apply-sources', () => ({
  useApplySources: () => ({ data: { options: [], applyMap: {} }, isPending: false }),
}));

vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding: {}, blocks: [], brandLabel: null, loading: false }),
}));

/** The row the detail query returns once the invoice exists. */
const savedInvoiceRow = {
  id: INVOICE_ID,
  couple_id: COUPLE_ID,
  couple: { name: 'Amy & Ben' },
  invoice_number: 'INV-0001',
  title: 'Wedding invoice',
  notes: null,
  status: 'draft',
  due_date: null,
  payment_terms: null,
  tax_rate: null,
  gst_inclusive: false,
  discount_type: null,
  discount_value: null,
  stripe_payment_enabled: false,
  share_token: SHARE_TOKEN,
  share_token_enabled: true,
  email_sent_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
  invoice_payment_stages: [],
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: 'u1', app_metadata: {}, user_metadata: {} } },
        }),
    },
    from: (table: string) => {
      const rows = table === 'couples' ? [{ id: COUPLE_ID, name: 'Amy & Ben' }] : [];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      };
      for (const method of ['select', 'eq', 'order', 'is', 'not', 'update']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.single = () =>
        Promise.resolve(
          table === 'invoices'
            ? { data: savedInvoiceRow, error: null }
            : { data: null, error: null },
        );
      return chain;
    },
  }),
}));

vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { InvoiceBuilderModal } = await import('@/components/builders/invoice-builder-modal');

function renderNewInvoice() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoiceBuilderModal
        invoiceId="new"
        initialCoupleId={COUPLE_ID}
        isOpen
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

/** Types into the hero title so the form is dirty and Save is enabled. */
async function editTitleAndSave(user: ReturnType<typeof userEvent.setup>) {
  const titleInput = await screen.findByPlaceholderText('Invoice for Amy & Ben');
  await user.type(titleInput, 'Wedding invoice');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
}

beforeEach(() => {
  saveInvoiceAction.mockReset();
  saveInvoiceAction.mockResolvedValue({ ok: true, data: { id: INVOICE_ID } });
});

describe('invoice builder id adoption after the first save', () => {
  it('shows no share controls before the invoice has ever been saved', async () => {
    renderNewInvoice();
    await waitFor(() => expect(screen.getByText('Notes')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Copy share link' })).toBeNull();
  });

  it('reveals the share link controls once the first save lands', async () => {
    const user = userEvent.setup();
    renderNewInvoice();
    await waitFor(() => expect(screen.getByText('Notes')).toBeInTheDocument());

    await editTitleAndSave(user);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copy share link' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Share link live')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      expect.stringContaining(`/invoice/${SHARE_TOKEN}`),
    );
    expect(screen.getByRole('button', { name: /Mark as sent/ })).toBeInTheDocument();
  });

  it('updates the created invoice on the next save instead of inserting another', async () => {
    const user = userEvent.setup();
    renderNewInvoice();
    await waitFor(() => expect(screen.getByText('Notes')).toBeInTheDocument());

    await editTitleAndSave(user);
    await waitFor(() => expect(saveInvoiceAction).toHaveBeenCalledTimes(1));
    expect(saveInvoiceAction.mock.calls[0]![0]).toMatchObject({ invoiceId: null });

    await editTitleAndSave(user);
    await waitFor(() => expect(saveInvoiceAction).toHaveBeenCalledTimes(2));
    expect(saveInvoiceAction.mock.calls[1]![0]).toMatchObject({ invoiceId: INVOICE_ID });
  });
});
