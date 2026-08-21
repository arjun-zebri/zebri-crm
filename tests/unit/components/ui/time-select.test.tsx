import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TimeSelect } from '@/components/ui/time-select';

describe('<TimeSelect />', () => {
  beforeEach(() => {
    // Radix needs these in jsdom before it opens.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  it('renders with a value in 24h format and displays it as 12h label', () => {
    render(<TimeSelect value="10:00" onChange={() => {}} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('10:00 AM');
  });

  it('respects placeholder when no value is set', () => {
    render(<TimeSelect onChange={() => {}} placeholder="Select time" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Select time');
  });

  it('generates options from startHour to endHour with minuteStep interval', async () => {
    render(<TimeSelect value="" onChange={() => {}} startHour={6} endHour={8} minuteStep={30} placeholder="Pick" />);
    await userEvent.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    // 6:00, 6:30, 7:00, 7:30, 8:00, 8:30 = 6 options
    expect(options).toHaveLength(6);
    expect(options[0]).toHaveTextContent('6:00 AM');
    expect(options[2]).toHaveTextContent('7:00 AM');
    expect(options[4]).toHaveTextContent('8:00 AM');
  });

  it('calls onChange with 24h value when an option is selected', async () => {
    const onChange = vi.fn();
    render(<TimeSelect value="" onChange={onChange} startHour={12} endHour={15} minuteStep={30} placeholder="Pick" />);
    await userEvent.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: '1:30 PM' });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('13:30');
  });

  it('respects default startHour and endHour of 6 to 22', async () => {
    render(<TimeSelect value="" onChange={() => {}} minuteStep={60} placeholder="Pick" />);
    await userEvent.click(screen.getByRole('combobox'));

    // Should start at 6:00 AM and end at 10:00 PM (22:00)
    // 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22 = 17 options
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(17);
    expect(options[0]).toHaveTextContent('6:00 AM');
    expect(options[16]).toHaveTextContent('10:00 PM');
  });

  it('converts 24h values correctly to 12h display in options', async () => {
    render(<TimeSelect value="" onChange={() => {}} startHour={0} endHour={2} minuteStep={60} placeholder="Pick" />);
    await userEvent.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('12:00 AM'); // 0:00
    expect(options[1]).toHaveTextContent('1:00 AM');  // 1:00
    expect(options[2]).toHaveTextContent('2:00 AM');  // 2:00
  });
});
