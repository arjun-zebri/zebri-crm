import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CalendarField } from '@/components/ui-v2/calendar-field';
import { ComboField } from '@/components/ui-v2/combo-field';
import { Input } from '@/components/ui-v2/input';

/** The boxed fields for forms a stranger fills in: optional marks, the calendar with its year picker, and the typed country list. */

beforeAll(() => {
  // Radix reaches for pointer-capture and scrolling APIs jsdom does not implement.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

describe('<Input boxed optional /> (v2)', () => {
  it('marks an optional boxed field after its name, and only a boxed one', () => {
    render(
      <>
        <Input boxed optional label="Other given names" />
        <Input optional label="Venue" />
      </>,
    );
    expect(screen.getByLabelText('Other given names (optional)')).toBeInTheDocument();
    expect(screen.queryByText('(optional)', { exact: false, selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByText(/\(optional\)/)).toHaveLength(1);
  });
});

describe('<Input boxed error /> (v2)', () => {
  it('edges an invalid boxed field in red, and only that one', () => {
    render(
      <>
        <Input boxed label="Email" error="Enter a valid email address." />
        <Input boxed label="Name" />
      </>,
    );
    // Only the red class: two border colours on one element resolve by stylesheet order, and the neutral one won.
    expect(screen.getByLabelText('Email')).toHaveClass('border-danger');
    expect(screen.getByLabelText('Email')).not.toHaveClass('border-zebra-200');
    expect(screen.getByLabelText('Name')).toHaveClass('border-zebra-200');
    expect(screen.getByLabelText('Name')).not.toHaveClass('border-danger');
  });
});

describe('<CalendarField /> (v2)', () => {
  function Dob({ onChange }: { onChange: (iso: string) => void }) {
    const [v, setV] = useState('');
    return (
      <>
        <CalendarField label="Date of birth" value={v} onChange={(iso) => (setV(iso), onChange(iso))} openYear={1990} max="2026-10-15" />
        <button type="button">Elsewhere</button>
      </>
    );
  }

  it('takes a date typed DD / MM / YYYY, moving on as each part fills', async () => {
    const onChange = vi.fn();
    render(<Dob onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Day'));
    await userEvent.keyboard('14031994');
    expect(onChange).toHaveBeenCalledWith('1994-03-14');
  });

  it('says what is missing once focus leaves a half-typed date', async () => {
    render(<Dob onChange={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Day'));
    await userEvent.keyboard('14');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add the day, month and four-digit year');
  });

  it('picks on the calendar, the year from a menu in its header', async () => {
    const onChange = vi.fn();
    render(<Dob onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date of birth on a calendar' }));
    expect(screen.getByRole('combobox', { name: 'Year' })).toHaveTextContent('1990');
    await userEvent.click(screen.getByRole('gridcell', { name: '7 January 1990' }));
    expect(onChange).toHaveBeenCalledWith('1990-01-07');
    expect(screen.getByLabelText('Year')).toHaveValue('1990');
  });
});

function Country({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState('');
  return <ComboField label="Country" options={['Australia', 'Germany', 'Ghana', 'New Zealand', 'Niger']} pinned={['Australia']} value={v} onChange={(x) => (setV(x), onChange(x))} />;
}

describe('<ComboField /> (v2)', () => {
  it('narrows the list as you type, starts-with first, and picks with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<Country onChange={onChange} />);
    const box = screen.getByRole('combobox', { name: 'Country' });
    await userEvent.type(box, 'n');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['New Zealand', 'Niger', 'Germany', 'Ghana']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('Niger');
    expect(box).toHaveValue('Niger');
  });

  it('leads with the pinned options while nothing is typed, and puts the pick back on Escape', async () => {
    render(<Country />);
    const box = screen.getByRole('combobox', { name: 'Country' });
    await userEvent.click(box);
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Australia');
    await userEvent.type(box, 'zzz');
    expect(screen.getByText('Nothing by that name')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(box).toHaveValue('');
  });
});
