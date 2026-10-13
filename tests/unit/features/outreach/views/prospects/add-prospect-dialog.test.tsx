/**
 * Add prospect form: a typo shows under its field without a save, and a
 * good entry saves once and hands back the new id so the page can open it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/toast';
import { AddProspectDialog } from '@/features/outreach/views/prospects/add-prospect-dialog';

const addProspectAction = vi.fn<(input: unknown) => Promise<{ ok: true; data: { id: string } }>>(async () => ({ ok: true, data: { id: 'new-id' } }));
vi.mock('@/features/outreach/actions', () => ({
  addProspectAction: (input: unknown) => addProspectAction(input),
}));

function renderDialog(onAdded = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AddProspectDialog onClose={vi.fn()} onAdded={onAdded} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onAdded;
}

describe('AddProspectDialog', () => {
  beforeEach(() => addProspectAction.mockClear());

  it('shows field errors and does not save', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
    expect(screen.getByText('Enter their name.')).toBeInTheDocument();
    expect(screen.getByText('That email address does not look right.')).toBeInTheDocument();
    expect(addProspectAction).not.toHaveBeenCalled();
  });

  it('saves and hands back the new id', async () => {
    const onAdded = renderDialog();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@jane' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
    expect(addProspectAction).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Jane Smith', state: null }));
    // Why: the dialog sends the builder's normalised handle (no @), not the raw typing.
    expect(addProspectAction).toHaveBeenCalledWith(expect.not.objectContaining({ instagram: '@jane' }));
  });
});
