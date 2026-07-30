/**
 * Unit tests for `app/api/stripe/invoice-payment/route` - the rate-limit,
 * Zod validation, invoice lookup, stage selection, and metadata assembly
 * branches. The Stripe SDK happy path is intentionally not exercised (it's
 * a network call covered by manual smoke); these tests pin the gates that
 * stand between an attacker and that call.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createSessionMock = vi.fn();
const getUserByIdMock = vi.fn();

let invoiceQueryMock: ReturnType<typeof vi.fn>;
let stagesQueryMock: ReturnType<typeof vi.fn>;

vi.mock('@/lib/payments/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: createSessionMock,
      },
    },
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: invoiceQueryMock,
              }),
            }),
          }),
        };
      }
      if (table === 'invoice_payment_stages') {
        return {
          select: () => ({
            eq: () => ({
              order: stagesQueryMock,
            }),
          }),
        };
      }
    }),
    auth: {
      admin: {
        getUserById: getUserByIdMock,
      },
    },
  })),
}));

vi.mock('@/lib/alerts/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  createSessionMock.mockReset().mockResolvedValue({ url: 'https://checkout.test/s' });
  getUserByIdMock.mockReset();
  invoiceQueryMock = vi.fn();
  stagesQueryMock = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

async function loadRoute() {
  return await import('@/app/api/stripe/invoice-payment/route');
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/stripe/invoice-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/stripe/invoice-payment', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
  const stageId1 = '550e8400-e29b-41d4-a716-446655440001';
  const stageId2 = '550e8400-e29b-41d4-a716-446655440002';
  const userId = '550e8400-e29b-41d4-a716-446655440003';

  const invoiceRow = {
    id: invoiceId,
    title: 'Wedding',
    subtotal: 5000,
    tax_rate: 10,
    status: 'sent',
    stripe_payment_enabled: true,
    share_token: 'tok-12345678',
    user_id: userId,
    couple_id: '550e8400-e29b-41d4-a716-446655440004',
  };

  const mcUser = {
    id: userId,
    app_metadata: {
      stripe_connect_account_id: 'acct_1',
      stripe_connect_enabled: true,
    },
  };

  const stages = [
    { id: stageId1, position: 1, label: 'Deposit', amount_cents: 150_000, paid_at: null },
    { id: stageId2, position: 2, label: 'Final', amount_cents: 350_000, paid_at: null },
  ];

  it('charges one stage and records its id in metadata', async () => {
    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: stages, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'stage',
      stageId: stageId1,
    }));

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
    const args = createSessionMock.mock.calls[0]![0];
    expect(args.line_items[0].price_data.unit_amount).toBe(150_000);
    expect(args.metadata.stage_ids).toBe(stageId1);
  });

  it('rejects paying a later stage before the earliest unpaid one', async () => {
    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: stages, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'stage',
      stageId: stageId2,
    }));

    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('charges every unpaid stage for a remaining payment', async () => {
    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: stages, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'remaining',
    }));

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
    const args = createSessionMock.mock.calls[0]![0];
    expect(args.line_items[0].price_data.unit_amount).toBe(500_000);
    expect(args.metadata.stage_ids).toBe(`${stageId1},${stageId2}`);
  });

  it('rejects a stage payment with no stageId', async () => {
    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'stage',
    }));

    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('stageless invoice charges the full tax-inclusive total and sends empty stage_ids', async () => {
    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: [], error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'remaining',
    }));

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
    const args = createSessionMock.mock.calls[0]![0];
    // subtotal 5000, tax 10% = 500, total = 5500, in cents = 550000
    expect(args.line_items[0].price_data.unit_amount).toBe(550_000);
    expect(args.metadata.stage_ids).toBe('');
  });

  it('charges only the earliest unpaid stage when position 1 is already paid', async () => {
    const paidStages = [
      { id: stageId1, position: 1, label: 'Deposit', amount_cents: 150_000, paid_at: '2026-07-01' },
      { id: stageId2, position: 2, label: 'Final', amount_cents: 350_000, paid_at: null },
    ];

    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: paidStages, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'stage',
      stageId: stageId2,
    }));

    expect(res.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
    const args = createSessionMock.mock.calls[0]![0];
    expect(args.line_items[0].price_data.unit_amount).toBe(350_000);
    expect(args.metadata.stage_ids).toBe(stageId2);
  });

  it('rejects a remaining payment when all stages are already paid', async () => {
    const allPaidStages = [
      { id: stageId1, position: 1, label: 'Deposit', amount_cents: 150_000, paid_at: '2026-07-01' },
      { id: stageId2, position: 2, label: 'Final', amount_cents: 350_000, paid_at: '2026-07-02' },
    ];

    invoiceQueryMock.mockResolvedValue({ data: invoiceRow, error: null });
    stagesQueryMock.mockResolvedValue({ data: allPaidStages, error: null });
    getUserByIdMock.mockResolvedValue({ data: { user: mcUser }, error: null });

    const { POST } = await loadRoute();
    const res = await POST(req({
      invoiceId,
      shareToken: 'tok-12345678',
      paymentType: 'remaining',
    }));

    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
