/**
 * Unit tests for ShareAndSend — the footer with the primary CTA.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ShareAndSend } from '@/components/builders/parts/share-and-send';

function base() {
  return {
    dirty: false,
    shareEnabled: false,
    shareUrl: null,
    lastSentAt: null,
    locked: false,
    saving: false,
    sending: false,
    hasCouple: true,
    onSave: vi.fn(),
    onSend: vi.fn(),
  };
}

describe('ShareAndSend', () => {
  it('renders "Send to couple" by default', () => {
    render(<ShareAndSend {...base()} />);
    expect(screen.getByRole('button', { name: 'Send to couple' })).toBeInTheDocument();
  });

  it('flips to "Resend" + timestamp once sent', () => {
    render(<ShareAndSend {...base()} lastSentAt="2026-05-22T00:00:00Z" shareEnabled shareUrl="https://x/y" />);
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(screen.getByText(/Sent/)).toBeInTheDocument();
  });

  it('disables Save when not dirty', () => {
    render(<ShareAndSend {...base()} dirty={false} />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('enables Save when dirty', () => {
    render(<ShareAndSend {...base()} dirty />);
    expect(screen.getByRole('button', { name: 'Save changes' })).not.toBeDisabled();
  });

  it('disables Send when no couple is selected', () => {
    render(<ShareAndSend {...base()} hasCouple={false} />);
    expect(screen.getByRole('button', { name: 'Send to couple' })).toBeDisabled();
  });

  it('shows the empty share copy when not yet enabled', () => {
    render(<ShareAndSend {...base()} />);
    expect(screen.getByText(/Send to enable share link/i)).toBeInTheDocument();
  });

  it('exposes Copy link + Open buttons when shareEnabled', () => {
    render(<ShareAndSend {...base()} shareEnabled shareUrl="https://x/y" />);
    // URL is no longer rendered as a visible input — it lives behind
    // a Copy button + an Open link (new tab).
    expect(screen.queryByDisplayValue('https://x/y')).toBeNull();
    expect(screen.getByRole('button', { name: /Copy share link/i })).toBeInTheDocument();
    const open = screen.getByRole('link', { name: /Open/i });
    expect(open).toHaveAttribute('href', 'https://x/y');
    expect(open).toHaveAttribute('target', '_blank');
  });

  it('calls onSave when Save is clicked', async () => {
    const p = base();
    p.dirty = true;
    render(<ShareAndSend {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(p.onSave).toHaveBeenCalledOnce();
  });

  it('calls onSend when Send is clicked', async () => {
    const p = base();
    render(<ShareAndSend {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send to couple' }));
    expect(p.onSend).toHaveBeenCalledOnce();
  });
});
