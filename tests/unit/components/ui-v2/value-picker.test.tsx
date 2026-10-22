import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { amountLabel, readAmount, type Amount } from '@/components/ui-v2/value-menu';
import { ValuePicker } from '@/components/ui-v2/value-picker';

type Unit = 'days' | 'weeks' | 'months';
const UNITS: Unit[] = ['days', 'weeks', 'months'];
const MAX: Record<Unit, number> = { days: 180, weeks: 26, months: 12 };
const PRESETS: Amount<Unit>[] = [3, 7, 14].map((n) => ({ n, unit: 'days' }));

function DueIn({ start = { n: 7, unit: 'days' } }: { start?: Amount<Unit> }) {
  const [v, setV] = useState<Amount<Unit>>(start);
  return <ValuePicker label="Due in" value={v} presets={PRESETS} show={amountLabel} read={(t) => readAmount(t, UNITS, MAX)} onPick={setV} />;
}

describe('readAmount', () => {
  it('lists a bare number in every unit that takes it', () => {
    expect(readAmount('9', UNITS, MAX).map(amountLabel)).toEqual(['9 days', '9 weeks', '9 months']);
    expect(readAmount('30', UNITS, MAX).map(amountLabel)).toEqual(['30 days']);
  });

  it('narrows by the letters typed, and reads nothing without a number', () => {
    expect(readAmount('9 w', UNITS, MAX).map(amountLabel)).toEqual(['9 weeks']);
    expect(readAmount('soon', UNITS, MAX)).toEqual([]);
    expect(readAmount('0', ['%'], { '%': 100 })).toEqual([]);
    expect(readAmount('0', ['%'], { '%': 100 }, 0)).toEqual([{ n: 0, unit: '%' }]);
  });

  it('says one without the plural', () => {
    expect(amountLabel({ n: 1, unit: 'weeks' })).toBe('1 week');
    expect(amountLabel({ n: 25, unit: '%' })).toBe('25%');
  });
});

describe('<ValuePicker /> (v2)', () => {
  it('shows the value on its button and the presets in its menu, the current one ticked', async () => {
    render(<DueIn />);
    await userEvent.click(screen.getByRole('button', { name: 'Due in: 7 days. Change' }));
    expect(screen.getByRole('menuitemradio', { name: '7 days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'Due in: type a value' })).toHaveFocus();
  });

  it('takes a typed value: the matches replace the presets, Enter picks the first', async () => {
    render(<DueIn />);
    await userEvent.click(screen.getByRole('button', { name: /Due in/ }));
    await userEvent.keyboard('9');
    expect(screen.getAllByRole('menuitemradio').map((r) => r.textContent)).toEqual(['9 days', '9 weeks', '9 months']);
    await userEvent.click(screen.getByRole('menuitemradio', { name: '9 weeks' }));
    expect(screen.getByRole('button', { name: 'Due in: 9 weeks. Change' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Due in/ }));
    await userEvent.keyboard('5{Enter}');
    expect(screen.getByRole('button', { name: 'Due in: 5 days. Change' })).toBeInTheDocument();
  });

  it('lists a custom value first, ticked, and says when typing reads as nothing', async () => {
    render(<DueIn start={{ n: 9, unit: 'weeks' }} />);
    await userEvent.click(screen.getByRole('button', { name: /Due in/ }));
    expect(screen.getAllByRole('menuitemradio')[0]).toHaveAccessibleName('9 weeks');
    expect(screen.getAllByRole('menuitemradio')[0]).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('soon');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getByText('Not a number')).toBeInTheDocument();
  });

  it('offers a second choice under the values, and reads short on its rows', async () => {
    type Balance = { span: Amount<Unit>; from: 'event' | 'invoice' };
    const FROM = { event: 'before the event', invoice: 'after this invoice' } as const;
    function BalanceDue() {
      const [b, setB] = useState<Balance>({ span: { n: 14, unit: 'days' }, from: 'event' });
      return (
        <ValuePicker
          label="Balance due"
          value={b}
          presets={PRESETS.map((span) => ({ span, from: b.from }))}
          show={(v) => `${amountLabel(v.span)} ${FROM[v.from]}`}
          row={(v) => amountLabel(v.span)}
          read={(t) => readAmount(t, UNITS, MAX).map((span) => ({ span, from: b.from }))}
          also={(['event', 'invoice'] as const).map((f) => ({ label: FROM[f], value: { span: b.span, from: f }, selected: f === b.from }))}
          onPick={setB}
        />
      );
    }
    render(<BalanceDue />);
    await userEvent.click(screen.getByRole('button', { name: 'Balance due: 14 days before the event. Change' }));
    expect(screen.getByRole('menuitemradio', { name: '14 days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'before the event' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'after this invoice' }));
    expect(screen.getByRole('button', { name: 'Balance due: 14 days after this invoice. Change' })).toBeInTheDocument();
  });
});
