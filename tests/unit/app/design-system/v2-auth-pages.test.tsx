import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { LoginPageV2 } from '@/app/design-system/v2/pages/login-form';
import { SignupPageV2 } from '@/app/design-system/v2/pages/signup-form';

// next/image needs the Next runtime; a stand-in with the same alt is enough.
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
// The forms route to onboarding on success; outside Next there is no app router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

describe('v2 log in page', () => {
  it('shows field errors when submitted empty', async () => {
    render(<LoginPageV2 />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
  });

  it('goes busy when the form is valid', async () => {
    render(<LoginPageV2 />);
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('v2 auth page layout', () => {
  it('puts the logo, heading, social options and footer link inside the one card', () => {
    render(<LoginPageV2 />);
    const card = screen.getByRole('region', { name: 'Welcome back' });
    expect(within(card).getByRole('img', { name: 'Zebri' })).toBeInTheDocument();
    expect(within(card).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Continue with Outlook' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });
});

describe('v2 sign up page', () => {
  it('asks only for email and password', () => {
    render(<SignupPageV2 />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
  });

  it('rejects a short password', async () => {
    render(<SignupPageV2 />);
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    // The help line stays when the error joins it (Field keeps help under an error).
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 8 characters. Use at least 8 characters.',
    );
  });
});
