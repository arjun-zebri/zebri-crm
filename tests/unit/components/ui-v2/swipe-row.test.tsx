import { render, screen } from '@testing-library/react';

import { SwipeRow } from '@/components/ui-v2/swipe-row';

describe('SwipeRow', () => {
  it('lists each child as an item under its name', () => {
    render(
      <SwipeRow aria-label="Plans" until="md">
        <p>Pro</p>
        <p>Max</p>
      </SwipeRow>,
    );
    const list = screen.getByRole('list', { name: 'Plans' });
    expect(list.tagName).toBe('UL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('is an ordered list for steps, and skips empty children', () => {
    render(
      <SwipeRow aria-label="Journey" until="lg" ordered item="step">
        <p>Thank-you email</p>
        {null}
        <p>Proposal</p>
      </SwipeRow>,
    );
    expect(screen.getByRole('list', { name: 'Journey' }).tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the current item in view without throwing where the row does not scroll', () => {
    const { rerender } = render(
      <SwipeRow aria-label="Plans" until="md" current={0}>
        <p>Pro</p>
        <p>Max</p>
      </SwipeRow>,
    );
    rerender(
      <SwipeRow aria-label="Plans" until="md" current={1}>
        <p>Pro</p>
        <p>Max</p>
      </SwipeRow>,
    );
    expect(screen.getByText('Max')).toBeInTheDocument();
  });
});
