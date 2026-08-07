import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { CopyButton } from '@/components/ui/copy-button';

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe('<CopyButton />', () => {
  it('writes the value to the clipboard', async () => {
    const writeText = stubClipboard();
    render(<CopyButton value="https://zebri.app/x" label="Copy link" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(writeText).toHaveBeenCalledWith('https://zebri.app/x');
  });

  it('accepts a function so a caller can defer anything touching window', async () => {
    const writeText = stubClipboard();
    render(<CopyButton value={() => 'built-at-click'} />);

    await userEvent.click(screen.getByRole('button'));

    expect(writeText).toHaveBeenCalledWith('built-at-click');
  });

  it('keeps both labels mounted so the button never resizes', async () => {
    // Idle and confirmed labels share one grid cell. If only one were
    // rendered the button would jump between "Copy link" and "Copied".
    stubClipboard();
    render(<CopyButton value="x" label="Copy link" copiedLabel="Copied" />);

    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByText('Copied')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('swaps which label is visible after a copy', async () => {
    stubClipboard();
    render(<CopyButton value="x" label="Copy link" copiedLabel="Copied" />);

    expect(screen.getByText('Copy link').className).not.toMatch(/\binvisible\b/);
    expect(screen.getByText('Copied')).toHaveClass('invisible');

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(screen.getByText('Copy link')).toHaveClass('invisible');
    expect(screen.getByText('Copied').className).not.toMatch(/\binvisible\b/);
  });

  it('stacks both labels in the same grid cell', async () => {
    stubClipboard();
    render(<CopyButton value="x" label="Copy link" />);

    expect(screen.getByText('Copy link')).toHaveClass('col-start-1', 'row-start-1');
    expect(screen.getByText('Copied')).toHaveClass('col-start-1', 'row-start-1');
  });

  it('reverts to the idle label after the timeout', async () => {
    stubClipboard();
    render(<CopyButton value="x" label="Copy" revertAfterMs={20} />);

    // fireEvent, not userEvent: userEvent's internal waits deadlock
    // against the awaited clipboard promise once timers are involved.
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(screen.getByText('Copied').className).not.toMatch(/\binvisible\b/),
    );

    await waitFor(() => expect(screen.getByText('Copied')).toHaveClass('invisible'));
  });

  it('does not blow up when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
      writable: true,
    });
    render(<CopyButton value="x" label="Copy" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    // Still idle: nothing was copied, so nothing is confirmed.
    expect(screen.getByText('Copied')).toHaveClass('invisible');
  });

  it('renders bare text in plain mode, for meta rows', () => {
    stubClipboard();
    render(<CopyButton value="x" label="Copy link" plain />);

    const btn = screen.getByRole('button', { name: 'Copy link' });
    expect(btn.className).not.toMatch(/\bh-8\b/);
    expect(btn).toHaveClass('text-text-muted');
  });
});
