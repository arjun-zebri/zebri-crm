import { render, screen, waitFor } from '@testing-library/react';

import { Collapse } from '@/components/ui-v2/collapse';

describe('<Collapse /> (v2)', () => {
  it('keeps shut content mounted but inert, and open content live', () => {
    render(
      <>
        <Collapse open={false}>
          <button type="button">Shut</button>
        </Collapse>
        <Collapse open>
          <button type="button">Open</button>
        </Collapse>
      </>,
    );
    expect(screen.getByText('Shut').closest('[inert]')).not.toBeNull();
    expect(screen.getByText('Shut').closest('.grid')).toHaveClass('grid-rows-[0fr]');
    expect(screen.getByText('Open').closest('[inert]')).toBeNull();
    expect(screen.getByText('Open').closest('.grid')).toHaveClass('grid-rows-[1fr]');
  });

  it('with appear, mounts shut and then eases open', async () => {
    render(
      <Collapse open appear>
        <p>New row</p>
      </Collapse>,
    );
    const box = screen.getByText('New row').closest('.grid');
    expect(box).toHaveClass('grid-rows-[0fr]');
    // Focusable at once: inert follows `open`, not the animation.
    expect(box).not.toHaveAttribute('inert');
    await waitFor(() => expect(box).toHaveClass('grid-rows-[1fr]'));
  });
});
