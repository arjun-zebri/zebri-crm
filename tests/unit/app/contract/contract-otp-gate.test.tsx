/**
 * Unit tests for the signing verification gate's failure copy.
 *
 * The gate has one job when a request fails: say something true. "We could not
 * send a code" invites the signer to retry, which is right for a transport
 * failure and wrong for a link that is not active yet — the code path a draft
 * contract takes, because `issue_signer_otp` only issues for `status = 'sent'`.
 *
 * @module tests/unit/app/contract/contract-otp-gate.test
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContractOtpGate } from '@/app/contract/[token]/_components/contract-otp-gate';

function renderGate() {
  return render(
    <ContractOtpGate
      token="11111111-2222-4333-8444-555555555555"
      onVerified={vi.fn()}
    />,
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ContractOtpGate failure copy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not blame the mail transport when the link is not active', async () => {
    // A draft contract resolves to not_found: no amount of retrying sends a
    // code, so "try again shortly" is the one thing not to say.
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { error: 'not_found' }));

    renderGate();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('could not send a code');
    expect(alert.textContent).toMatch(/not active/i);
  });

  it('still offers a retry when the send itself failed', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(500, { error: 'Could not send a code' }),
    );

    renderGate();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not send a code');
  });

  it('asks the signer to wait when rate limited', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(429, { error: 'too_many_requests', retry_after: 60 }),
    );

    renderGate();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/wait a moment/i);
    });
  });
});
