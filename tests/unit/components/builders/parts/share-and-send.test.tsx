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

  it('hides the share-status row when shareUrl is not available (e.g. brand-new draft)', () => {
    // Post-2026-05-27: share_token_enabled defaults to true on
    // insert, so the only time the left side is empty is when
    // shareUrl itself is null. The "Send to enable share link"
    // copy was removed when this stopped being a real state.
    render(<ShareAndSend {...base()} />);
    expect(screen.queryByText(/Send to enable share link/i)).toBeNull();
    expect(screen.queryByText(/Share link live/i)).toBeNull();
  });

  it('shows "Share link live" when the URL is available but not yet sent', () => {
    render(<ShareAndSend {...base()} shareEnabled shareUrl="https://x/y" />);
    expect(screen.getByText(/Share link live/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy share link/i })).toBeInTheDocument();
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

  it('offers per-contact Copy link on a draft, with the go-live note', async () => {
    const user = userEvent.setup();
    render(
      <ShareAndSend
        {...base()}
        shareEnabled={false}
        shareUrl="https://x/y"
        signerLinks={[{ label: 'Primary contact', name: 'Alex', url: 'https://x/contract/a' }]}
        signerLinksNote="These links go live when you send the contract."
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByText('These links go live when you send the contract.')).toBeInTheDocument();
  });

  it('reports the per-contact popover opening, so an unsaved draft can save itself', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <ShareAndSend
        {...base()}
        signerLinks={[{ label: 'Primary contact', name: 'Alex', url: null, unavailableReason: 'Created when the contract is saved.' }]}
        onSignerLinksOpen={onOpen}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Copy link for primary contact' })).toBeDisabled();
  });

  it('offers Download PDF on a draft whose link is not live', () => {
    // The PDF is about the document, not the link. Gating the contract link
    // on send must not take the PDF away with it.
    render(<ShareAndSend {...base()} shareEnabled={false} shareUrl="https://x/y" onDownloadPdf={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();
  });

  it('opens a per-contact popover from Copy link, greying out a missing secondary', async () => {
    const user = userEvent.setup();
    render(
      <ShareAndSend
        {...base()}
        shareEnabled
        shareUrl="https://x/share"
        signerLinks={[
          { label: 'Primary contact', name: 'Alex Rivera', url: 'https://x/contract/a' },
          { label: 'Secondary contact', name: null, url: null, unavailableReason: 'No secondary contact.' },
        ]}
      />,
    );
    // No Open with per-contact links: the MC opening one would log a
    // 'viewed' event in that contact's name.
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link for primary contact' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy link for secondary contact' })).toBeDisabled();

    await user.hover(screen.getByText('Not set'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No secondary contact.');
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

  it('does not render "Mark as sent" unless canMarkSent + a live link', () => {
    // No affordance on a brand-new (non-live) draft…
    render(<ShareAndSend {...base()} canMarkSent onMarkSent={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Mark as sent/i })).toBeNull();
  });

  it('renders "Mark as sent" for a live draft and calls onMarkSent', async () => {
    const onMarkSent = vi.fn();
    render(
      <ShareAndSend
        {...base()}
        shareEnabled
        shareUrl="https://x/y"
        canMarkSent
        onMarkSent={onMarkSent}
      />,
    );
    const btn = screen.getByRole('button', { name: /Mark as sent/i });
    await userEvent.click(btn);
    expect(onMarkSent).toHaveBeenCalledOnce();
  });

  it('hides "Mark as sent" once the doc is no longer a draft', () => {
    // canMarkSent is driven by status === 'draft' upstream; once sent
    // the affordance is gone (the status pill carries it from there).
    render(
      <ShareAndSend
        {...base()}
        shareEnabled
        shareUrl="https://x/y"
        lastSentAt="2026-05-22T00:00:00Z"
        canMarkSent={false}
        onMarkSent={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Mark as sent/i })).toBeNull();
  });
});
