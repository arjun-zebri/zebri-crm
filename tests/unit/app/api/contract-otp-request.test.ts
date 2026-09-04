/**
 * Unit tests for the contract signing OTP request route.
 *
 * The route's job is to turn `issue_signer_otp` into one emailed code. What
 * matters here is that a newly issued code is emailed *as the MC* — from their
 * connected mailbox, with their branding and the real contract number —
 * because the fallback path sends from the shared Zebri address, which is a
 * different deliverability story and reads as a stranger to the signer.
 *
 * @module tests/unit/app/api/contract-otp-request.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/rate-limit')>();
  return {
    ...actual,
    inMemoryLimiter: () => ({ check: async () => ({ allowed: true, retryAfter: 0 }) }),
    ipOf: () => '203.0.113.9',
  };
});
vi.mock('@/lib/api/public-token-limiter', () => ({ recordInvalidTokenAttempt: vi.fn() }));
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const sendContractOtpEmail = vi.fn(async () => ({ ok: true }));
vi.mock('@/lib/email', () => ({
  sendContractOtpEmail: (...args: unknown[]) => sendContractOtpEmail(...(args as [])),
}));

const emailBrandingForUser = vi.fn(async () => ({ business_name: 'Arjun Weddings' }));
vi.mock('@/lib/email/branding', () => ({
  emailBrandingForUser: (...args: unknown[]) => emailBrandingForUser(...(args as [])),
}));

const resolveSender = vi.fn(async () => ({
  transport: 'oauth' as const,
  from: 'arjun@zebri.com.au',
  oauth: {},
}));
vi.mock('@/lib/email/sender-identity', () => ({
  resolveSender: (...args: unknown[]) => resolveSender(...(args as [])),
}));

const rpc = vi.fn();
const contractsRow = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc,
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => contractsRow(table, value),
        }),
      }),
    }),
  }),
}));

import { POST } from '@/app/api/contract/otp/request/route';

const TOKEN = '11111111-2222-4333-8444-555555555555';
const CONTRACT_ID = '99999999-8888-4777-8666-555555555555';

function request() {
  return new NextRequest('https://zebri.test/api/contract/otp/request', {
    method: 'POST',
    body: JSON.stringify({ token: TOKEN }),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/contract/otp/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendContractOtpEmail.mockResolvedValue({ ok: true });
    // A freshly issued code: the branch that must actually send an email.
    rpc.mockResolvedValue({
      data: {
        ok: true,
        required: true,
        reissued: true,
        otp_id: 'otp-1',
        expires_at: '2026-09-04T10:00:00Z',
        email: 'signer@example.com',
        name: 'Jane Signer',
      },
      error: null,
    });
    contractsRow.mockImplementation(async (table: string, value: string) => {
      // The real client rejects an empty string against a uuid column; model
      // that rather than returning a row for any lookup.
      if (table === 'contract_signer_otps' && value === 'otp-1') {
        return { data: { contract_id: CONTRACT_ID, user_id: 'user-1' }, error: null };
      }
      if (table === 'contracts' && value === CONTRACT_ID) {
        return { data: { contract_number: 'CON-1042' }, error: null };
      }
      return { data: null, error: { message: 'invalid input syntax for type uuid' } };
    });
  });

  it('emails the code from the MC, with their branding and contract number', async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(sendContractOtpEmail).toHaveBeenCalledTimes(1);

    const [opts] = sendContractOtpEmail.mock.calls[0] as unknown as [
      { contractNumber: string; mcBusinessName: string; sender?: unknown },
    ];
    // A blank contract number means the subject reads "Your code to sign ",
    // and a missing sender means it went from the shared Zebri address.
    expect(opts.contractNumber).toBe('CON-1042');
    expect(opts.mcBusinessName).toBe('Arjun Weddings');
    expect(opts.sender).toBeDefined();
  });

  it('does not resend when a live code already exists', async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        required: true,
        reissued: false,
        email: 'signer@example.com',
        name: 'Jane Signer',
      },
      error: null,
    });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(sendContractOtpEmail).not.toHaveBeenCalled();
  });
});
