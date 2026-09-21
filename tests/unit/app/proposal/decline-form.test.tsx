/**
 * Unit tests for `DeclineForm`: reason selection, the message, posting
 * `/api/proposal/decline`, and the inline error path.
 *
 * @module tests/unit/app/proposal/decline-form.test
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeclineForm } from '@/app/proposal/[token]/_components/decline-form';
import { buildPublicBranding } from '@/lib/branding/public-branding';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const branding = buildPublicBranding({ business_name: 'MC Co' });

describe('DeclineForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the selected reason and message, then calls onDeclined', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }));
    const onDeclined = vi.fn();
    render(<DeclineForm open onClose={vi.fn()} token="tok-1" branding={branding} onDeclined={onDeclined} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Price' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Went with a friend' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onDeclined).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/proposal/decline',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'tok-1', reason: 'price', message: 'Went with a friend' }),
      }),
    );
  });

  it('shows an inline error and does not call onDeclined on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { error: 'not_found' }));
    const onDeclined = vi.fn();
    render(<DeclineForm open onClose={vi.fn()} token="tok-1" branding={branding} onDeclined={onDeclined} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Price' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('This proposal is no longer available.');
    expect(onDeclined).not.toHaveBeenCalled();
  });
});
