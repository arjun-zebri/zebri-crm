import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '@/components/ui-v2/avatar';
import { AvatarStack } from '@/components/ui-v2/avatar-stack';

describe('Avatar', () => {
  it('shows a photo over the initials when given one', () => {
    const { container } = render(<Avatar name="Jess Taylor" src="/founding/jess.jpg" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/founding/jess.jpg');
    // The initials stay underneath, so a failed photo still shows the person.
    expect(container).toHaveTextContent('JT');
  });
});

describe('AvatarStack', () => {
  const people = [{ name: 'Jess Taylor' }, { name: 'Sam Lee' }];

  it('shows each face and the count of the rest', () => {
    const { container } = render(<AvatarStack people={people} more={23} />);
    // One letter a face: two would be clipped by the overlap.
    expect(container).toHaveTextContent('JS+23');
  });

  it('leaves the count out at zero', () => {
    const { container } = render(<AvatarStack people={people} />);
    expect(container).not.toHaveTextContent('+');
  });

  it('is hidden from screen readers unless labelled', () => {
    const { container, rerender } = render(<AvatarStack people={people} more={3} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<AvatarStack people={people} more={3} label="Jess, Sam and 3 more" />);
    expect(screen.getByRole('img', { name: 'Jess, Sam and 3 more' })).toBeInTheDocument();
  });
});
