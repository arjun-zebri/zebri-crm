import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Modal } from '@/components/ui/modal';
import { useScrollLock } from '@/components/ui/use-overlay';

/** Stand-in for a bespoke fullscreen overlay (profile/settings): locks
 *  scroll like they do, without being a Modal. */
function BespokeOverlay({ children }: { children?: React.ReactNode }) {
  useScrollLock(true);
  return <div>{children}</div>;
}

/** The rendered backdrop element (first fixed inset-0 without flex). */
function backdropEl(): HTMLElement {
  return document.querySelector('.fixed.inset-0.h-screen') as HTMLElement;
}

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

  describe('auto stacking tier', () => {
    it('uses the base tier when nothing else covers the page', () => {
      render(
        <Modal isOpen onClose={() => {}} title="Test">
          <p>body</p>
        </Modal>,
      );
      expect(backdropEl().className).toContain('z-50');
    });

    it('keeps the base tier across re-renders (own scroll lock must not count)', () => {
      const { rerender } = render(
        <Modal isOpen onClose={() => {}} title="Test">
          <p>body</p>
        </Modal>,
      );
      rerender(
        <Modal isOpen onClose={() => {}} title="Test">
          <p>changed</p>
        </Modal>,
      );
      expect(backdropEl().className).toContain('z-50');
    });

    it('auto-nests when opened while a bespoke fullscreen overlay holds the scroll lock', () => {
      // The couple-send-email bug: a base backdrop (z-50) opened inside
      // the couple-profile overlay (panel z-[60]) is swallowed behind
      // the panel, so the modal shows with no dark backdrop.
      function Harness({ open }: { open: boolean }) {
        return (
          <BespokeOverlay>
            <Modal isOpen={open} onClose={() => {}} title="Test">
              <p>body</p>
            </Modal>
          </BespokeOverlay>
        );
      }
      const { rerender } = render(<Harness open={false} />);
      rerender(<Harness open />);
      expect(backdropEl().className).toContain('z-[75]');
    });

    it('an explicit layer always wins over the auto tier', () => {
      function Harness({ open }: { open: boolean }) {
        return (
          <BespokeOverlay>
            <Modal isOpen={open} onClose={() => {}} title="Test" layer="top">
              <p>body</p>
            </Modal>
          </BespokeOverlay>
        );
      }
      const { rerender } = render(<Harness open={false} />);
      rerender(<Harness open />);
      expect(backdropEl().className).toContain('z-[120]');
    });
  });
});
