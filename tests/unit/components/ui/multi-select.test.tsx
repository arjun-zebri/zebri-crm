/**
 * MultiSelect: the design-system control for choosing several values
 * from a list, with the choices shown as removable chips.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MultiSelect } from '@/components/ui/multi-select';

const STAGES = [
  { value: 'lost', label: 'Lost' },
  { value: 'confirmed', label: 'Booked' },
  { value: 'paid', label: 'Paid in full' },
];

function Harness({ initial = [] as string[], onChange = vi.fn() }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <MultiSelect
      label="Stop when the couple moves to"
      options={STAGES}
      value={value}
      placeholder="No stages"
      onValueChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe('MultiSelect', () => {
  it('shows the placeholder with nothing chosen, and a chip per choice otherwise', () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByRole('button', { name: /Stop when the couple moves to/ })).toHaveTextContent(
      'No stages',
    );
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    unmount();

    render(<Harness initial={['lost', 'confirmed']} />);
    expect(screen.getByRole('button', { name: /Stop when the couple moves to/ })).toHaveTextContent(
      '2 chosen',
    );
    expect(screen.getByRole('button', { name: 'Remove Lost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Booked' })).toBeInTheDocument();
  });

  it('adds and removes a value by ticking it in the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={['lost']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Stop when the couple moves to/ }));
    const list = await screen.findByRole('group', { name: 'Stop when the couple moves to' });
    expect(within(list).getByRole('checkbox', { name: 'Lost' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(list).getByRole('checkbox', { name: 'Booked' }));
    expect(onChange).toHaveBeenLastCalledWith(['lost', 'confirmed']);

    await user.click(within(list).getByRole('checkbox', { name: 'Lost' }));
    expect(onChange).toHaveBeenLastCalledWith(['confirmed']);
  });

  it('removes a value from its chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={['lost', 'paid']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Remove Lost' }));

    expect(onChange).toHaveBeenLastCalledWith(['paid']);
    expect(screen.queryByRole('button', { name: 'Remove Lost' })).toBeNull();
  });

  it('keeps a chosen value that is no longer an option, labelled by the value itself', () => {
    render(<Harness initial={['archived_stage']} />);
    expect(screen.getByRole('button', { name: 'Remove archived_stage' })).toBeInTheDocument();
  });

  it('shows an error in place of the help text', () => {
    render(
      <MultiSelect
        label="Stages"
        options={STAGES}
        value={[]}
        onValueChange={() => {}}
        help="Pick any"
        error="That did not save."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('That did not save.');
    expect(screen.queryByText('Pick any')).toBeNull();
  });

  it('disables the list and the chips together', () => {
    render(
      <MultiSelect label="Stages" options={STAGES} value={['lost']} onValueChange={() => {}} disabled />,
    );
    expect(screen.getByRole('button', { name: /Stages/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Lost' })).toBeDisabled();
  });

  it('draws its chevron at 1.5 and gives each chip remove a focus ring and a larger hit area', () => {
    const { container } = render(<Harness initial={['lost']} />);
    expect(container.querySelector('svg.lucide-chevron-down')).toHaveAttribute('stroke-width', '1.5');
    const remove = screen.getByRole('button', { name: 'Remove Lost' });
    expect(remove.className).toMatch(/focus-visible:ring/);
    // A 12px icon alone is too small a target; the button pads it to 20px.
    expect(remove.className).toMatch(/\bp-1\b/);
  });
});
