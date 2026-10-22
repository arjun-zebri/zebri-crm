/**
 * The setup guide card: one button only, on the current step; done steps
 * show a check and muted copy; the N-of-5 count; the optional row never
 * carries a button.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SetupGuide } from '@/features/outreach/views/today/setup-guide';
import { deriveSetup, type SetupFacts } from '@/lib/outreach/setup';

/** Mailbox and identity done; the sheet is imported; nothing checked yet. */
const midway: SetupFacts = {
  mailboxConnected: true,
  gmailConfigured: true,
  senderName: 'Jo',
  signature: 'Jo, Zebri',
  prospectCount: 40,
  checkedCount: 0,
  sequenceCount: 0,
  launchedCampaignCount: 0,
  apifyConfigured: false,
  usesBooking: false,
  bookingPageSet: false,
};

const stepItem = (title: string) => screen.getByText(title, { selector: 'p' }).closest('li') as HTMLElement;

describe('SetupGuide', () => {
  it('shows the done count on the right of the heading', () => {
    render(<SetupGuide setup={deriveSetup(midway)} />);
    expect(screen.getByRole('heading', { name: 'Get set up' })).toBeInTheDocument();
    expect(screen.getByText('2 of 5 done')).toBeInTheDocument();
  });

  it('gives the button only to the current step', () => {
    render(<SetupGuide setup={deriveSetup(midway)} />);
    const check = stepItem('Run the activity check');
    expect(within(check).getByRole('link', { name: 'Run check' })).toHaveAttribute('href', '/admin/outreach?view=prospects&check=1');

    for (const title of ['Connect Gmail', 'Import your celebrant sheet', 'Write your first sequence', 'Launch a campaign']) {
      expect(within(stepItem(title)).queryByRole('link')).toBeNull();
    }
  });

  it('shows a done step with a check and no button', () => {
    render(<SetupGuide setup={deriveSetup(midway)} />);
    const gmail = stepItem('Connect Gmail');
    expect(within(gmail).getByText('(done)', { exact: false })).toBeInTheDocument();
    expect(within(gmail).queryByRole('link')).toBeNull();
  });

  it('keeps the Instagram row free of buttons and labelled optional', () => {
    render(<SetupGuide setup={deriveSetup(midway)} />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Ask your developer to add the Apify key to turn on Instagram checks.')).toBeInTheDocument();
    const optional = screen.getByText('Instagram lookups').closest('div')?.parentElement as HTMLElement;
    expect(within(optional).queryByRole('link')).toBeNull();
  });

  it('shows the booking warning under the campaign step only', () => {
    const setup = deriveSetup({ ...midway, usesBooking: true, bookingPageSet: false });
    render(<SetupGuide setup={setup} />);
    const campaign = stepItem('Launch a campaign');
    expect(within(campaign).getByRole('note')).toHaveTextContent('Your templates use {{booking_link}}. Pick a booking page in Settings.');
    expect(within(stepItem('Run the activity check')).queryByRole('note')).toBeNull();
  });

  it('counts five of five when everything is done', () => {
    const done = deriveSetup({ ...midway, prospectCount: 1, checkedCount: 1, sequenceCount: 1, launchedCampaignCount: 1 });
    render(<SetupGuide setup={done} />);
    expect(screen.getByText('5 of 5 done')).toBeInTheDocument();
  });
});
