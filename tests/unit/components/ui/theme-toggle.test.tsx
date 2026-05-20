import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach } from 'vitest';

import { ThemeToggle } from '@/components/ui/theme-toggle';

describe('<ThemeToggle />', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('renders a button with an accessible label reflecting the next theme', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('clicking adds the `dark` class on <html> and persists the choice', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('zebri-theme')).toBe('dark');
  });

  it('clicking again toggles back to light and updates storage', async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    await userEvent.click(btn);
    await userEvent.click(btn);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('zebri-theme')).toBe('light');
  });

  it('reflects an already-dark <html> on mount', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    // Next action is "switch to light" when currently dark.
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
