import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Disclosure } from '@/components/ui-v2/disclosure';

describe('Disclosure', () => {
  it('starts shut, with the answer out of reach', () => {
    render(<Disclosure title="Is there a free plan?">A 7-day trial.</Disclosure>);
    const button = screen.getByRole('button', { name: 'Is there a free plan?' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls');
  });

  it('opens and shuts from the question', async () => {
    render(<Disclosure title="Is there a free plan?">A 7-day trial.</Disclosure>);
    const button = screen.getByRole('button', { name: 'Is there a free plan?' });
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('A 7-day trial.')).toBeVisible();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('can start open', () => {
    render(<Disclosure title="Q" defaultOpen>A</Disclosure>);
    expect(screen.getByRole('button', { name: 'Q' })).toHaveAttribute('aria-expanded', 'true');
  });
});
