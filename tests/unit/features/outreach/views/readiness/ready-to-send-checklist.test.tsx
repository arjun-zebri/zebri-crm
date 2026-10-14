/**
 * The Ready to send checklist: missing rows link to their fix, done rows
 * do not, and Campaigns hides the whole card once nothing is missing.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReadyToSendChecklist } from '@/features/outreach/views/readiness/ready-to-send-checklist';
import { readinessItems, type ReadinessFacts } from '@/lib/outreach/readiness';

const base: ReadinessFacts = {
  mailboxConnected: false,
  gmailConfigured: true,
  senderName: '',
  signature: 'Jo, Zebri',
  bookingPageSet: false,
  apifyConfigured: true,
  sendingPaused: false,
  usesEmail: true,
  usesBooking: false,
};

const hrefFor = (anchor: string) => `#${anchor}`;

describe('ReadyToSendChecklist', () => {
  it('shows a done row without a Fix link and a missing row with one', () => {
    render(<ReadyToSendChecklist items={readinessItems(base)} hrefFor={hrefFor} />);

    const signature = screen.getByText('Add your signature').closest('li') as HTMLElement;
    expect(within(signature).queryByRole('link', { name: 'Fix' })).toBeNull();

    const gmail = screen.getByText('Connect Gmail').closest('li') as HTMLElement;
    expect(within(gmail).getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '#mailbox');
  });

  it('points the sender row at the Sending section', () => {
    render(<ReadyToSendChecklist items={readinessItems(base)} hrefFor={hrefFor} />);
    const sender = screen.getByText('Add your sender name').closest('li') as HTMLElement;
    expect(within(sender).getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '#sending');
  });

  it('counts what is missing in plain words', () => {
    render(<ReadyToSendChecklist items={readinessItems(base)} hrefFor={hrefFor} />);
    // Gmail and sender are missing; signature is done; booking is hidden; lookups are optional.
    expect(screen.getByText('2 things to set up before campaigns can send.')).toBeInTheDocument();
  });

  it('never links or counts Instagram lookups when they are missing', () => {
    const onlyApify = { ...base, mailboxConnected: true, senderName: 'Jo', apifyConfigured: false };
    render(<ReadyToSendChecklist items={readinessItems(onlyApify)} hrefFor={hrefFor} />);
    const row = screen.getByText('Instagram lookups').closest('li') as HTMLElement;
    expect(within(row).queryByRole('link')).toBeNull();
    expect(screen.getByText('Everything is set up. Campaigns can start.')).toBeInTheDocument();
  });

  it('hides the booking row when no template needs it', () => {
    render(<ReadyToSendChecklist items={readinessItems(base)} hrefFor={hrefFor} />);
    expect(screen.queryByText('Booking page chosen')).toBeNull();
  });

  it('renders nothing on Campaigns once every shown row is done', () => {
    const complete = { ...base, mailboxConnected: true, senderName: 'Jo' };
    const { container } = render(
      <ReadyToSendChecklist items={readinessItems(complete)} hrefFor={hrefFor} hideWhenComplete />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the card on Settings when everything is done, as a status panel', () => {
    const complete = { ...base, mailboxConnected: true, senderName: 'Jo' };
    render(<ReadyToSendChecklist items={readinessItems(complete)} hrefFor={hrefFor} />);
    expect(screen.getByText('Everything is set up. Campaigns can start.')).toBeInTheDocument();
  });
});
