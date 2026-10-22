import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { OnboardingFlow } from '@/app/design-system/v2/pages/onboarding/onboarding-flow';
import { rolesFromName } from '@/app/design-system/v2/pages/onboarding/step-about';

// next/image needs the Next runtime; a stand-in with the same alt is enough.
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
// Go to Zebri routes to the first-run dashboard; outside Next there is no app router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const start = () => userEvent.click(screen.getByRole('button', { name: 'Set up my business' }));
const finish = () => userEvent.click(screen.getByRole('button', { name: 'Go to Zebri' }));

beforeEach(() => window.localStorage.clear());

// Setup is one screen since 2026-09-30: the cover, then "Tell us about you"
// and Go to Zebri. The old nine-step flow was deleted on 2026-10-14.
describe('v2 onboarding flow', () => {
  it('opens on the welcome cover, with no way to skip', () => {
    render(<OnboardingFlow />);
    expect(screen.getByRole('heading', { name: 'Ten tools. Now one.' })).toBeVisible();
    // Two lists in the DOM (orbit and phone list); CSS shows one at a time.
    const lists = screen.getAllByRole('list', { name: 'What Zebri replaces' });
    expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByRole('button', { name: /skip|later|close/i })).not.toBeInTheDocument();
  });

  it('asks about the MC on one screen, offering no skip', async () => {
    render(<OnboardingFlow />);
    await start();
    expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip|close/i })).not.toBeInTheDocument();
  });

  it('names each empty field in its placeholder, the quiet-name rule', async () => {
    render(<OnboardingFlow />);
    await start();
    expect(screen.getByLabelText('Your name')).toHaveValue('');
    expect(screen.getByLabelText('Your name')).toHaveAttribute('placeholder', 'Your name');
    expect(screen.getByLabelText('Business or stage name')).toHaveAttribute('placeholder', 'Business or stage name');
    expect(screen.queryByText(/optional/i)).not.toBeInTheDocument();
  });

  it('waits for a name before it goes to Zebri', async () => {
    render(<OnboardingFlow />);
    await start();
    await finish();
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Add your name so clients know who they are talking to.',
    );
  });

  it('goes busy once a name is given', async () => {
    render(<OnboardingFlow />);
    await start();
    await userEvent.type(screen.getByLabelText('Your name'), 'Jane Doe');
    await finish();
    expect(screen.getByRole('button', { name: 'Go to Zebri' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('onboarding helpers', () => {
  it('reads roles from a business name', () => {
    expect(rolesFromName('Jane Doe Celebrant')).toEqual(['Celebrant']);
    expect(rolesFromName('DJ Sam & MC Services')).toEqual(['MC', 'DJ']);
    expect(rolesFromName('Moments by Jane')).toEqual([]);
  });
});
