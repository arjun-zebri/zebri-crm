import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Select } from '@/components/ui/select';

const OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'booked', label: 'Booked' },
];

describe('<Select />', () => {
  it('renders the label, trigger, and placeholder when empty', () => {
    render(<Select label="Status" placeholder="Pick one" options={OPTIONS} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    // Radix trigger exposes a `combobox` role.
    const trigger = screen.getByRole('combobox', { name: 'Status' });
    expect(trigger).toHaveTextContent('Pick one');
  });

  it('shows the selected option as the trigger label', () => {
    render(<Select label="Status" value="booked" options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Booked');
  });

  it('sizes the portalled panel, since it does not inherit the trigger', async () => {
    // The dropdown renders into document.body, outside the trigger's
    // subtree, so it inherits the body's 16px unless the panel says so
    // itself. Without `text-body` on the panel the options rendered
    // visibly larger than the placeholder they replaced.
    //
    // Radix needs these two in jsdom before it will open a Select.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};

    render(<Select label="Status" placeholder="Pick one" options={OPTIONS} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));

    const option = await screen.findByRole('option', { name: 'New' });
    expect(option.closest('.text-body')).not.toBeNull();
  });

  it('renders an error message with role=alert and marks the trigger invalid', () => {
    render(
      <Select label="Status" error="Required" options={OPTIONS} />,
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
