import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { useScrollLock } from '@/components/ui/use-overlay';

/**
 * Scroll locking is reference-counted across every surface that covers
 * the page, including the bespoke overlays that are not built on Modal
 * (couple profile, contact profile, settings modal).
 *
 * Two failure modes matter and they pull in opposite directions:
 * releasing too eagerly unlocks the page while another surface is still
 * up, and releasing too conservatively leaves the page frozen after
 * everything has closed. Both were live before the count existed.
 */

/** Stand-in for the couple / contact profile: covers the page, locks
 *  through the shared count, and renders its dialog as a descendant. */
function BespokeOverlay({
  open,
  children,
}: {
  open: boolean;
  children?: React.ReactNode;
}) {
  useScrollLock(open);
  if (!open) return null;
  return <div data-testid="bespoke">{children}</div>;
}

const confirmProps = {
  title: 'Delete this couple?',
  description: 'Cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('overlay scroll lock', () => {
  beforeEach(() => {
    document.body.style.removeProperty('overflow');
  });

  it('leaves the page scrollable after a confirm and its bespoke parent close together', () => {
    // The real "delete the couple" path: confirming unmounts the profile
    // and the dialog inside it in the same commit.
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(false)}>close all</button>
          <BespokeOverlay open={open}>
            <ConfirmDialog {...confirmProps} open />
          </BespokeOverlay>
        </>
      );
    }

    const { getByText } = render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(getByText('close all'));

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('leaves the page scrollable when a bespoke parent unmounts a Modal with it', () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(false)}>close all</button>
          <BespokeOverlay open={open}>
            <Modal isOpen onClose={vi.fn()} title="Inner">
              <p>body</p>
            </Modal>
          </BespokeOverlay>
        </>
      );
    }

    const { getByText } = render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(getByText('close all'));

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('keeps the page locked when only the confirm closes', () => {
    function Harness({ confirmOpen }: { confirmOpen: boolean }) {
      return (
        <BespokeOverlay open>
          <ConfirmDialog {...confirmProps} open={confirmOpen} />
        </BespokeOverlay>
      );
    }

    const { rerender } = render(<Harness confirmOpen />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness confirmOpen={false} />);

    // The profile is still open, so the page must stay locked.
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps the page locked when the parent closes but the dialog outlives it', () => {
    // Siblings rather than parent and child, so release order is
    // genuinely reversed. The count must not care.
    function Harness({ parentOpen }: { parentOpen: boolean }) {
      return (
        <>
          <BespokeOverlay open={parentOpen} />
          <ConfirmDialog {...confirmProps} open />
        </>
      );
    }

    const { rerender } = render(<Harness parentOpen />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness parentOpen={false} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores scrolling once a standalone overlay closes with nothing underneath', () => {
    const { rerender } = render(
      <Modal isOpen onClose={vi.fn()} title="Alone">
        <p>body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Alone">
        <p>body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('releases cleanly no matter which overlay closes first', () => {
    function Harness({ a, b }: { a: boolean; b: boolean }) {
      return (
        <>
          <BespokeOverlay open={a} />
          <Modal isOpen={b} onClose={vi.fn()} title="B">
            <p>body</p>
          </Modal>
        </>
      );
    }

    const { rerender } = render(<Harness a b />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness a={false} b />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness a={false} b={false} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
