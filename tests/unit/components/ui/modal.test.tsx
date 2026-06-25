import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Modal } from '@/components/ui/modal';

describe('<Modal />', () => {
  it('closes when the backdrop is clicked (press and release on the backdrop)', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test">
        <input aria-label="field" />
      </Modal>,
    );

    // The centering wrapper around the panel is the backdrop the user
    // clicks. Press and release both land on it.
    const backdrop = document.querySelector('.fixed.inset-0.flex') as HTMLElement;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when a text selection started inside an input drags out and releases on the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test">
        <input aria-label="field" />
      </Modal>,
    );

    const field = screen.getByLabelText('field');
    const backdrop = document.querySelector('.fixed.inset-0.flex') as HTMLElement;

    // Drag-to-select: press starts inside the input, the mouseup/click
    // lands on the backdrop (the click target the browser computes is
    // the common ancestor — the backdrop wrapper).
    fireEvent.mouseDown(field);
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes from the explicit close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test">
        <input aria-label="field" />
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
