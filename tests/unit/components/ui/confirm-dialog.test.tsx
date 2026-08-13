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
    // The inline style is removed rather than overwritten, so the
    // stylesheet decides again.
    expect(document.body.style.overflow).not.toBe('hidden');
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

  // The dialog renders inline (fixed-position, not portalled), so it is
  // a DOM descendant of whatever opened it. In the automations table it
  // sits inside a clickable <tr>: confirming a delete also fired the
  // row's onClick, navigating to the automation that had just been
  // deleted. A modal must never leak clicks to its ancestors.
  describe('click containment', () => {
    it('does not fire an ancestor onClick when confirming', async () => {
      const onConfirm = vi.fn();
      const rowClick = vi.fn();
      render(
        <div onClick={rowClick}>
          <ConfirmDialog {...base} open onConfirm={onConfirm} />
        </div>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(rowClick).not.toHaveBeenCalled();
    });

    it('does not fire an ancestor onClick when cancelling', async () => {
      const onCancel = vi.fn();
      const rowClick = vi.fn();
      render(
        <div onClick={rowClick}>
          <ConfirmDialog {...base} open onCancel={onCancel} />
        </div>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(rowClick).not.toHaveBeenCalled();
    });

    it('does not fire an ancestor onClick when dismissing via the backdrop', async () => {
      const onCancel = vi.fn();
      const rowClick = vi.fn();
      render(
        <div onClick={rowClick}>
          <ConfirmDialog {...base} open onCancel={onCancel} />
        </div>,
      );

      await userEvent.click(screen.getByRole('dialog'));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(rowClick).not.toHaveBeenCalled();
    });
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
