import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { LeadForm } from '@/app/lead/[token]/_components/lead-form';
import type { PublicLeadForm } from '@/app/lead/[token]/_components/public-lead-form';
import { buildPublicBranding } from '@/lib/branding/public-branding';

const token = '11111111-1111-4111-8111-111111111111';

const blocks: Block[] = [
  { id: 'f_name', type: 'formField', role: 'name', inputType: 'text', label: 'Your name', required: true },
  { id: 'f_email', type: 'formField', role: 'email', inputType: 'email', label: 'Email', required: true },
  { id: 'f_guests', type: 'formField', role: 'custom', inputType: 'text', label: 'Guests', required: false },
  { id: 's1', type: 'formSubmit', label: 'Send it', successMessage: 'Got it, thanks!' },
];

function formWith(tree: Block[] | null): PublicLeadForm {
  return { ...buildPublicBranding({}), enabled: true, business_name: 'Curzon MCs', blocks: tree };
}

afterEach(() => vi.restoreAllMocks());

describe('LeadForm (block tree)', () => {
  it('renders the block-defined fields and submit label', () => {
    render(<LeadForm token={token} form={formWith(blocks)} />);
    expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^email$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /guests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send it/i })).toBeInTheDocument();
  });

  it('keeps submit disabled until required fields are filled', () => {
    render(<LeadForm token={token} form={formWith(blocks)} />);
    const submit = screen.getByRole('button', { name: /send it/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'Jamie' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), { target: { value: 'j@example.test' } });
    expect(submit).toBeEnabled();
  });

  it('maps roles into the payload (custom → custom bag) and shows the block success message', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<LeadForm token={token} form={formWith(blocks)} />);

    fireEvent.change(screen.getByRole('textbox', { name: /your name/i }), { target: { value: 'Jamie' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), { target: { value: 'j@example.test' } });
    fireEvent.change(screen.getByRole('textbox', { name: /guests/i }), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /send it/i }));

    await waitFor(() => expect(screen.getByText(/got it, thanks!/i)).toBeInTheDocument());

    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1]?.body as string) ?? '{}');
    expect(body.name).toBe('Jamie');
    expect(body.email).toBe('j@example.test');
    expect(body.custom).toEqual([{ label: 'Guests', value: '120' }]);
    expect(body.token).toBe(token);
  });
});
