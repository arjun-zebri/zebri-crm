/**
 * The couple's "Add a to-do" composer.
 *
 * It replaced an inline row that had no room for a note, so the two
 * things worth pinning are that a nameless to-do cannot be saved and
 * that the note reaches the caller.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CoupleTodoModal } from '@/app/(dashboard)/couples/couple-todo-modal';

type TodoInput = { title: string; description: string | null; dueAt: string | null };
const noop = () => vi.fn<(input: TodoInput) => Promise<void>>(async () => {});

function renderModal(onAdd = noop()) {
  const onClose = vi.fn();
  render(<CoupleTodoModal isOpen onClose={onClose} onAdd={onAdd} />);
  return { onAdd, onClose };
}

describe('CoupleTodoModal', () => {
  it('will not save a to-do with no name', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('sends the name and the note, and closes', async () => {
    const onAdd = noop();
    const { onClose } = renderModal(onAdd);

    fireEvent.change(screen.getByLabelText('What needs doing'), {
      target: { value: '  Ring the venue  ' },
    });
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Ask about access time' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd).toHaveBeenCalledWith({
      title: 'Ring the venue',
      description: 'Ask about access time',
      dueAt: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('sends no note when the MC left it blank', async () => {
    const onAdd = noop();
    renderModal(onAdd);

    fireEvent.change(screen.getByLabelText('What needs doing'), {
      target: { value: 'Book the PA' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd.mock.calls[0]?.[0]).toMatchObject({ description: null });
  });
});
