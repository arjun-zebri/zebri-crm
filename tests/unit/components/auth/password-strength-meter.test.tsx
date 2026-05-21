import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';

describe('<PasswordStrengthMeter>', () => {
  it('renders nothing for empty password', () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders weak label for "abc"', () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText(/weak password/i)).toBeInTheDocument();
  });

  it('renders medium label for "Password1"', () => {
    render(<PasswordStrengthMeter password="Password1" />);
    expect(screen.getByText(/medium password/i)).toBeInTheDocument();
  });

  it('renders strong label for a long mixed-class password', () => {
    render(<PasswordStrengthMeter password="Sup3r-Secret-Pass!" />);
    expect(screen.getByText(/strong password/i)).toBeInTheDocument();
  });
});
