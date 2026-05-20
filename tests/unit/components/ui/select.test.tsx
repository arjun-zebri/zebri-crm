import { render, screen } from '@testing-library/react';

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

  it('renders an error message with role=alert and marks the trigger invalid', () => {
    render(
      <Select label="Status" error="Required" options={OPTIONS} />,
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
