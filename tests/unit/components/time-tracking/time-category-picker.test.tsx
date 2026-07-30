import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeCategoryPicker } from '@/components/time-tracking/time-category-picker';

const listMock = vi.fn();
const createMock = vi.fn();
const renameMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  listTimeCategoriesAction: () => listMock(),
  createTimeCategoryAction: (name: string) => createMock(name),
  renameTimeCategoryAction: (input: { id: string; name: string }) =>
    renameMock(input),
  deleteTimeCategoryAction: (id: string) => deleteMock(id),
}));

function renderPicker(props: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TimeCategoryPicker {...props} />
    </QueryClientProvider>,
  );
}

describe('TimeCategoryPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      ok: true,
      data: [
        { id: 'cat-1', name: 'Meeting', position: 0 },
        { id: 'cat-2', name: 'Travel', position: 1 },
      ],
    });
  });

  it('lists the user categories when opened', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    expect(
      await screen.findByRole('button', { name: 'Meeting' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travel' })).toBeInTheDocument();
  });

  it('selecting a category reports its id', async () => {
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Travel' }));
    expect(onChange).toHaveBeenCalledWith('cat-2');
  });

  it('filters as you type', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(
      await screen.findByPlaceholderText(/search categories/i),
      'trav',
    );
    expect(screen.getByRole('button', { name: 'Travel' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Meeting' }),
    ).not.toBeInTheDocument();
  });

  it('offers Create for an unmatched name and selects the new category', async () => {
    createMock.mockResolvedValue({
      ok: true,
      data: { id: 'cat-3', name: 'Vows', position: 2 },
    });
    const onChange = vi.fn();
    renderPicker({ value: null, onChange });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(
      await screen.findByPlaceholderText(/search categories/i),
      'Vows',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /create "vows"/i }),
    );
    await waitFor(() => expect(createMock).toHaveBeenCalledWith('Vows'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('cat-3'));
  });

  it('does not offer Create when the typed name already exists', async () => {
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(
      await screen.findByPlaceholderText(/search categories/i),
      'meeting',
    );
    expect(
      screen.queryByRole('button', { name: /create "meeting"/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the selected category on the trigger', async () => {
    renderPicker({ value: 'cat-1', onChange: vi.fn() });
    expect(
      await screen.findByRole('button', { name: /meeting/i }),
    ).toBeInTheDocument();
  });

  it('clearing the selection reports null', async () => {
    const onChange = vi.fn();
    renderPicker({ value: 'cat-1', onChange });
    await userEvent.click(
      await screen.findByRole('button', { name: /meeting/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renaming a category calls the action', async () => {
    renameMock.mockResolvedValue({
      ok: true,
      data: { id: 'cat-1', name: 'Client meeting', position: 0 },
    });
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /rename meeting/i }),
    );
    const input = screen.getByDisplayValue('Meeting');
    await userEvent.clear(input);
    await userEvent.type(input, 'Client meeting{Enter}');
    await waitFor(() =>
      expect(renameMock).toHaveBeenCalledWith({
        id: 'cat-1',
        name: 'Client meeting',
      }),
    );
  });

  it('deleting a category calls the action', async () => {
    deleteMock.mockResolvedValue({ ok: true, data: null });
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /delete meeting/i }),
    );
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('cat-1'));
  });

  it('shows a created category immediately, before the server responds', async () => {
    // The action never settles: the UI must not wait for it.
    createMock.mockReturnValue(new Promise(() => {}));
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.type(
      await screen.findByPlaceholderText(/search categories/i),
      'Vows',
    );
    await userEvent.click(screen.getByRole('button', { name: /create "vows"/i }));
    // Trigger shows the typed name straight away, popover closed.
    expect(
      await screen.findByRole('button', { name: /vows/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/search categories/i),
    ).not.toBeInTheDocument();
  });

  it('removes a deleted category immediately, before the server responds', async () => {
    deleteMock.mockReturnValue(new Promise(() => {}));
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /delete meeting/i }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Meeting' }),
      ).not.toBeInTheDocument(),
    );
    // Travel is untouched.
    expect(screen.getByRole('button', { name: 'Travel' })).toBeInTheDocument();
  });

  it('renames a category immediately, before the server responds', async () => {
    renameMock.mockReturnValue(new Promise(() => {}));
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /rename meeting/i }),
    );
    const input = screen.getByDisplayValue('Meeting');
    await userEvent.clear(input);
    await userEvent.type(input, 'Client meeting{Enter}');
    expect(
      await screen.findByRole('button', { name: 'Client meeting' }),
    ).toBeInTheDocument();
  });

  it('rolls the list back when a delete fails', async () => {
    deleteMock.mockResolvedValue({ ok: false, error: 'nope' });
    renderPicker({ value: null, onChange: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /delete meeting/i }),
    );
    expect(
      await screen.findByRole('button', { name: 'Meeting' }),
    ).toBeInTheDocument();
  });

  it('clears the selection when the selected category is deleted', async () => {
    deleteMock.mockResolvedValue({ ok: true, data: null });
    const onChange = vi.fn();
    renderPicker({ value: 'cat-1', onChange });
    await userEvent.click(
      await screen.findByRole('button', { name: /meeting/i }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /delete meeting/i }),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
