import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { OFFERS } from '@/app/design-system/v2/pages/dashboard/first-run/plan-pricing';
import { BlocksPage } from '@/app/design-system/v2/pages/website/blocks-page';
import { FAQS } from '@/app/design-system/v2/pages/website/faq-data';
import { FOUNDING_PRICE, PERKS } from '@/app/design-system/v2/pages/website/founding-offer';
import { GuidesPage } from '@/app/design-system/v2/pages/website/guides-page';
import { PROMISES } from '@/app/design-system/v2/pages/website/hero-actions';
import { SHOT_STEPS } from '@/app/design-system/v2/pages/website/journey-shot';
import { BLOCKS_PATH, GUIDES_PATH, NAV_LINKS } from '@/app/design-system/v2/pages/website/nav-links';
import { FEATURES } from '@/app/design-system/v2/pages/website/site-features';
import { WebsitePage } from '@/app/design-system/v2/pages/website/website-page';

/** The waitlist band; the email form is scoped here. */
const waitlist = () => screen.getByRole('region', { name: 'Get on the list.' });
const pricing = () => screen.getByRole('region', { name: 'Simple pricing. No lock-in.' });
/** The desktop journey list; phones get a swipe row of the same steps, hidden by CSS only. */
const journeyList = (row: HTMLElement) => within(row).getAllByRole('list', { name: "Mia and Leo's journey" }).at(-1)!;

// next/image needs the Next runtime; a stand-in with the same alt is enough.
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
// jsdom has no ResizeObserver; the block images measure their width with one.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
// A mouse-and-keyboard screen: the dialog only starts on a named field where the pointer is fine.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === '(pointer: fine)',
  addEventListener() {},
  removeEventListener() {},
}));
// jsdom lacks the native dialog's methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

/** Gives the waitlist an email and waits out the button's beat, to the dialog. */
async function openDialog(email = 'jess@example.com') {
  await userEvent.type(within(waitlist()).getByLabelText('Email'), email);
  await userEvent.click(within(waitlist()).getByRole('button', { name: 'Join the waitlist' }));
  return screen.findByRole('dialog', {}, { timeout: 3000 });
}

describe('v2 marketing website', () => {
  it('has exactly one h1, the hero pitch', () => {
    render(<WebsitePage />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('You run the event. Zebri does the rest.');
  });

  it('lists Features, Guides, Blocks and Pricing in the nav', () => {
    render(<WebsitePage />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = NAV_LINKS.map((l) => l.label);
    expect(labels).toEqual(['Features', 'Guides', 'Blocks', 'Pricing']);
    for (const l of NAV_LINKS) expect(within(nav).getByRole('link', { name: l.label })).toHaveAttribute('href', l.href);
  });

  it('quotes the plan sheet prices, so the site never drifts from the app', () => {
    render(<WebsitePage />);
    // Pro at its usual price, nothing struck; Max at the founding price, struck from its usual one.
    const pro = OFFERS.find((o) => o.tier === 'pro')!;
    const max = OFFERS.find((o) => o.tier === 'max')!;
    expect(within(pricing()).getByText(`$${pro.was}`).tagName).not.toBe('S');
    expect(within(pricing()).getByText(`$${max.was}`).tagName).toBe('S');
    expect(within(pricing()).getAllByText(`$${FOUNDING_PRICE}`)).toHaveLength(1);
    // A celebrant reading the plans learns BDM lodgement is in Max, not only from the BDM band.
    expect(within(pricing()).getByText('BDM lodgement, for Celebrants')).toBeInTheDocument();
    expect(within(pricing()).getByText(/GST included/)).toBeInTheDocument();
    expect(within(pricing()).getByText(/Max for the price of Pro for their first 12 months/)).toBeInTheDocument();
  });

  it('gives Max and the founding perks one deal: Max at Pro’s price, recommended', () => {
    render(<WebsitePage />);
    // The site and the plan sheet quote one offer: Max at $47, Pro at its usual price.
    expect(FOUNDING_PRICE).toBe(OFFERS.find((o) => o.tier === 'max')!.monthly);
    expect(within(pricing()).getByText('$47')).toBeInTheDocument();
    expect(within(pricing()).getByText('$59')).toBeInTheDocument();
    const max = within(pricing()).getByRole('heading', { name: 'Max' }).parentElement!;
    expect(within(max).getByText('Recommended')).toBeInTheDocument();
    expect(within(pricing()).getAllByText('Recommended')).toHaveLength(1);
    // One price per card: no footnote quoting a second one.
    expect(within(pricing()).queryByText(/Founding members pay/)).toBeNull();
    expect(within(waitlist()).getByText('Max for the price of Pro')).toBeInTheDocument();
    // The old pair ("20% off" beside "Max features, free") made Max a worse deal than Pro.
    expect(PERKS.map((p) => p.title)).not.toContain('20% off');
  });

  it('opens an FAQ answer when its question is clicked', async () => {
    render(<WebsitePage />);
    const first = FAQS[0]!;
    const question = screen.getByRole('button', { name: first.q });
    expect(question).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(first.a)).toBeVisible();
  });

  it('shows who sends the invites, and no count of who is on the list', () => {
    render(<WebsitePage />);
    expect(within(waitlist()).queryByText(/already on the list/)).toBeNull();
    expect(within(waitlist()).getByText('Arjun, founder of Zebri')).toBeInTheDocument();
    expect(within(waitlist()).getByRole('link', { name: 'Email me' })).toHaveAttribute('href', 'mailto:arjun@zebri.com.au');
  });

  it('asks for a valid email before opening the waitlist dialog', async () => {
    render(<WebsitePage />);
    await userEvent.click(within(waitlist()).getByRole('button', { name: 'Join the waitlist' }));
    const email = within(waitlist()).getByLabelText('Email');
    expect(email).toHaveAccessibleDescription('Enter a valid email address.');
    expect(email).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the dialog on Your name, then asks for both answers before joining', async () => {
    render(<WebsitePage />);
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText('Your name')).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Join the waitlist' }));
    expect(within(dialog).getByLabelText('Your name')).toHaveAccessibleDescription('Enter your name.');
    expect(within(dialog).getByText('Pick what you do.')).toBeInTheDocument();
  });

  it('ends on a referral link to move up, with no place in line', async () => {
    render(<WebsitePage />);
    const dialog = await openDialog('jess.taylor@example.com');
    await userEvent.type(within(dialog).getByLabelText('Your name'), 'Jess Taylor');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Celebrant' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Join the waitlist' }));
    expect(await within(dialog).findByText('Move up the list', {}, { timeout: 3000 })).toBeInTheDocument();
    // A place in line would say how long the list is (founder, 2026-10-19).
    expect(within(dialog).queryByText(/^#\d/)).toBeNull();
    expect(within(dialog).getByLabelText('Your link')).toHaveValue('https://zebri.com.au/?ref=jesstaylor');
    expect(within(dialog).getByRole('button', { name: /Copy link/ })).toBeInTheDocument();
  });

  it('carries a pricing card’s plan to the waitlist form, cursor in Email', async () => {
    render(<WebsitePage />);
    expect(within(waitlist()).queryByText(/Joining with/)).toBeNull();
    await userEvent.click(within(pricing()).getByRole('button', { name: 'Join with Max' }));
    expect(within(waitlist()).getByText('Joining with Max')).toBeInTheDocument();
    expect(within(waitlist()).getByLabelText('Email')).toHaveFocus();
    const dialog = await openDialog();
    expect(within(dialog).getByText(/You picked Max\./)).toBeInTheDocument();
  });

  it('sends plan buttons to the waitlist and Enterprise to a person', () => {
    render(<WebsitePage />);
    for (const o of OFFERS) expect(within(pricing()).getByRole('button', { name: `Join with ${o.name}` })).toBeInTheDocument();
    expect(within(pricing()).getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    expect(within(pricing()).getByRole('button', { name: 'Talk to us' })).toBeInTheDocument();
  });

  it('gives each headline feature its own band, and every product picture is hidden from screen readers', () => {
    render(<WebsitePage />);
    for (const f of FEATURES) {
      const band = screen.getByRole('region', { name: f.title });
      expect(band).toHaveAttribute('id', f.id);
      // Security's tiles are real words, not a still of the app; every other band's picture is.
      if (f.id !== 'security') expect(band.querySelectorAll('[aria-hidden="true"][inert]').length).toBeGreaterThan(0);
    }
  });

  it('shows the Journeys band finished when it cannot play (no observer, as without script)', () => {
    render(<WebsitePage />);
    const row = screen.getByRole('region', { name: 'Every couple, followed up on time.' });
    for (const step of SHOT_STEPS) expect(row).toHaveTextContent(step.when);
    expect(row).toHaveTextContent('Booked');
    // Played to its end: the balance is paid, so the last step is the one on the stage.
    const items = within(journeyList(row)).getAllByRole('listitem');
    expect(items.at(-1)).toHaveAttribute('aria-current', 'step');
  });

  it('puts a done Journeys step back on the stage when it is clicked', async () => {
    render(<WebsitePage />);
    const row = screen.getByRole('region', { name: 'Every couple, followed up on time.' });
    await userEvent.click(within(journeyList(row)).getByRole('button', { name: 'Show the contract' }));
    const items = within(journeyList(row)).getAllByRole('listitem');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items.at(-1)).not.toHaveAttribute('aria-current');
  });

  it('shows the three BDM steps side by side, finished when it cannot play', () => {
    render(<WebsitePage />);
    const row = screen.getByRole('region', { name: 'Lodge marriages straight from Zebri.' });
    const steps = within(within(row).getByRole('list', { name: 'How lodging with Zebri works' })).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringContaining('Couples fill it in'),
      expect.stringContaining('Zebri checks it'),
      expect.stringContaining('You lodge with BDM'),
    ]);
    // Without an observer (as without script) every step has played: typed and saved, checked and fixed, registered.
    expect(steps[0]).toHaveTextContent('Saved');
    expect(within(steps[0]!).getByDisplayValue('Amelia Rose')).toBeInTheDocument();
    expect(steps[1]).toHaveTextContent('All 47 answers pass');
    expect(steps[1]).toHaveTextContent('Other given namesRose');
    expect(steps[2]).toHaveTextContent('Registered with NSW BDM');
    for (const s of steps) expect(s).not.toHaveAttribute('aria-current');
  });

  it('takes the hero Join the waitlist to the waitlist form, cursor in Email', async () => {
    render(<WebsitePage />);
    const hero = screen.getByRole('region', { name: 'You run the event. Zebri does the rest.' });
    await userEvent.click(within(hero).getByRole('button', { name: 'Join the waitlist' }));
    expect(within(waitlist()).getByLabelText('Email')).toHaveFocus();
  });

  it('offers a second step, the founding proof and the promises in the hero', () => {
    render(<WebsitePage />);
    const hero = screen.getByRole('region', { name: 'You run the event. Zebri does the rest.' });
    expect(within(hero).getByRole('button', { name: 'See how it works' })).toBeInTheDocument();
    expect(within(hero).getByText('10,000+ weddings between them')).toBeInTheDocument();
    for (const promise of PROMISES) expect(within(hero).getByText(promise.text)).toBeInTheDocument();
  });

  it('gives phones a menu with every nav section and Log in', async () => {
    render(<WebsitePage />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Close menu');
    const menu = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(menu).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/design-system/v2/login');
    expect(within(menu).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/design-system/v2/website#pricing');
    expect(within(menu).getByRole('link', { name: 'Blocks' })).toHaveAttribute('href', BLOCKS_PATH);
    await userEvent.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('sends the Blocks band’s See all to the Blocks page', () => {
    render(<WebsitePage />);
    const band = screen.getByRole('region', { name: 'Made for what you do.' });
    expect(within(band).getByRole('link', { name: 'See all' })).toHaveAttribute('href', BLOCKS_PATH);
  });

  it('lists every block on the Blocks page, with Blocks marked current in the nav', () => {
    render(<BlocksPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every block in Zebri.');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Blocks' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Guides' })).not.toHaveAttribute('aria-current');
    // It closes on the waitlist, so the nav's Join the waitlist lands on a form here too.
    expect(screen.getByRole('region', { name: 'Get on the list.' })).toBeInTheDocument();
  });

  it('says plainly on Guides that none are published yet', () => {
    render(<GuidesPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guides for wedding MCs and Celebrants.');
    expect(screen.getByText('The first guides are on the way')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Guides' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists every feature band and Zebri’s social accounts in the footer', () => {
    render(<WebsitePage />);
    const product = screen.getByRole('navigation', { name: 'Product' });
    for (const label of ['Journeys', 'BDM lodgement', 'Blocks', 'Zebri AI', 'Security', 'Pricing'])
      expect(within(product).getByRole('link', { name: label })).toBeInTheDocument();
    const socials = screen.getByRole('list', { name: 'Zebri on social media' });
    const resources = screen.getByRole('navigation', { name: 'Resources' });
    expect(within(resources).getByRole('link', { name: 'Guides' })).toHaveAttribute('href', GUIDES_PATH);
    // One Blocks link in the footer, to the page.
    expect(within(product).getByRole('link', { name: 'Blocks' })).toHaveAttribute('href', BLOCKS_PATH);
    expect(within(resources).queryByRole('link', { name: 'Blocks' })).toBeNull();
    expect(within(resources).getByRole('link', { name: 'FAQ' })).toBeInTheDocument();
    for (const name of ['Instagram', 'Facebook', 'LinkedIn'])
      expect(within(socials).getByRole('link', { name: `Zebri on ${name}` })).toBeInTheDocument();
  });
});
