import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeadForm } from '@/app/lead/[token]/_components/lead-form';
import type { PublicLeadForm } from '@/app/lead/[token]/_components/public-lead-form';
import { buildPublicBranding } from '@/lib/branding/public-branding';

const token = '11111111-1111-4111-8111-111111111111';

// A default-branded form with no saved block tree, so LeadForm renders the fixed
// fallback field set these tests assert on.
const fixedForm: PublicLeadForm = {
  ...buildPublicBranding({}),
  enabled: true,
  business_name: 'Curzon MCs',
  blocks: null,
};

afterEach(() => vi.restoreAllMocks());

describe('LeadForm', () => {
  it('renders required fields and the submit button', () => {
    render(<LeadForm token={token} form={fixedForm} />);
    expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send enquiry/i })).toBeInTheDocument();
  });

  it('shows a success state after a 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<LeadForm token={token} form={fixedForm} />);
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Jamie' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'jamie@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());
  });

  it('shows an error state after a failed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    render(<LeadForm token={token} form={fixedForm} />);
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), {
      target: { value: 'Jamie' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'jamie@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
  });
});
