/**
 * The `tooltip` prop on Select.
 *
 * "Minimum notice" and "Maximum advance" are settings whose names do not carry
 * their own meaning, so the explanation has to be reachable from the label
 * itself. It must be reachable by keyboard, not hover alone.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import { Select } from '@/components/ui/select';

const OPTIONS = [
  { value: '4', label: '4 hours' },
  { value: '24', label: '24 hours' },
];

describe('Select tooltip', () => {
  it('renders no help affordance when no tooltip is given', () => {
    render(<Select label="Minimum notice" options={OPTIONS} />);
    expect(screen.queryByRole('button', { name: /what does/i })).not.toBeInTheDocument();
  });

  it('reveals the explanation on hover', async () => {
    const user = userEvent.setup();
    render(
      <Select label="Minimum notice" tooltip="The least warning you will accept." options={OPTIONS} />,
    );

    const trigger = screen.getByRole('button', { name: 'What does Minimum notice mean?' });
    expect(screen.queryByText('The least warning you will accept.')).not.toBeInTheDocument();

    await user.hover(trigger);
    expect(await screen.findByText('The least warning you will accept.')).toBeInTheDocument();
  });

  it('reveals the explanation on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <Select label="Maximum advance" tooltip="The furthest ahead couples can book." options={OPTIONS} />,
    );

    // Why: a hover-only explanation is invisible to keyboard and touch users,
    // which is most of the reason these two fields were unclear to begin with.
    await user.tab();
    expect(await screen.findByText('The furthest ahead couples can book.')).toBeInTheDocument();
  });
});
