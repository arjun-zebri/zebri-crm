import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';

/**
 * Regression cover for the overlay bugs found by the /design-system
 * audit: ConfirmDialog used to ignore Escape, leave the page scrollable
 * behind it, and share the `z-[80]` tier with a nested Modal.
 */
describe('<ConfirmDialog />', () => {
  const base = {
    title: 'Delete this couple?',
    description: 'This cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('cancels on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<ConfirmDialog {...base} open />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<ConfirmDialog {...base} open={false} />);
    expect(document.body.style.overflow).toBe('unset');
  });

  it('exposes exactly one dialog, named and described by its own copy', () => {
    render(<ConfirmDialog {...base} open />);

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute('aria-modal', 'true');
    expect(dialogs[0]).toHaveAccessibleName('Delete this couple?');
    expect(dialogs[0]).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('cancels when the backdrop is pressed and released', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onCancel={onCancel} />);

    const backdrop = screen.getByRole('dialog');
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while loading', () => {
    render(<ConfirmDialog {...base} open loading loadingLabel="Deleting..." />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deleting/ })).toBeDisabled();
  });

  it('stacks above a nested Modal instead of tying with it', () => {
    render(
      <>
        <Modal isOpen onClose={vi.fn()} layer="nested" title="Nested">
          <p>body</p>
        </Modal>
        <ConfirmDialog {...base} open />
      </>,
    );

    const [nestedPanel, confirmPanel] = screen.getAllByRole('dialog');
    expect(nestedPanel).toHaveClass('z-[80]');
    expect(confirmPanel).toHaveClass('z-[130]');
  });

  it('takes Escape ahead of the Modal underneath it, leaving that Modal open', async () => {
    const closeModal = vi.fn();
    const cancelConfirm = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeModal} title="Underneath">
          <p>body</p>
        </Modal>
        <ConfirmDialog {...base} open onCancel={cancelConfirm} />
      </>,
    );

    await userEvent.keyboard('{Escape}');

    expect(cancelConfirm).toHaveBeenCalledTimes(1);
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('hands the scroll lock back to a bespoke overlay that set it first', () => {
    // The couple profile, contact profile and settings modal lock body
    // scroll themselves without going through useOverlay. Restoring a
    // hard-coded 'unset' here would unlock the page underneath them.
    document.body.style.overflow = 'hidden';

    const { rerender } = render(<ConfirmDialog {...base} open />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<ConfirmDialog {...base} open={false} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps the scroll lock when only the topmost overlay closes', () => {
    const { rerender } = render(
      <>
        <Modal isOpen onClose={vi.fn()} title="Underneath">
          <p>body</p>
        </Modal>
        <ConfirmDialog {...base} open />
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen onClose={vi.fn()} title="Underneath">
          <p>body</p>
        </Modal>
        <ConfirmDialog {...base} open={false} />
      </>,
    );

    // The Modal is still up, so the page must stay locked.
    expect(document.body.style.overflow).toBe('hidden');
  });
});
