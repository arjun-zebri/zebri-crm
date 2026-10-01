import { render, screen } from '@testing-library/react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { Panel } from '@/components/ui-v2/panel';

describe('<Panel /> (v2)', () => {
  it('renders the glass surface and keeps caller classes', () => {
    render(<Panel className="p-8">Body</Panel>);
    const el = screen.getByText('Body');
    expect(el.className).toContain('surface-glass');
    expect(el.className).toContain('rounded-panel');
    expect(el.className).toContain('p-8');
  });

  it('renders the highlight tone with tighter corners', () => {
    render(<Panel tone="highlight">Price</Panel>);
    const cls = screen.getByText('Price').className;
    expect(cls).toContain('surface-highlight');
    expect(cls).toContain('rounded-button');
    expect(cls).not.toContain('surface-glass');
  });

  it('adds the modal shadow only when raised', () => {
    const { rerender } = render(<Panel data-testid="p">x</Panel>);
    expect(screen.getByTestId('p')).not.toHaveClass('shadow-xl');
    rerender(
      <Panel data-testid="p" raised>
        x
      </Panel>,
    );
    expect(screen.getByTestId('p')).toHaveClass('shadow-xl');
  });

  it('renders as the requested landmark element', () => {
    render(
      <Panel as="section" aria-label="Plan">
        Body
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Plan' }).tagName).toBe('SECTION');
  });
});

describe('<Backdrop /> (v2)', () => {
  it('fills the viewport by default and is hidden from assistive tech', () => {
    render(<Backdrop />);
    const el = screen.getByTestId('backdrop');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('fixed');
  });

  it('fills its parent when contained', () => {
    render(<Backdrop contained />);
    expect(screen.getByTestId('backdrop').className).toContain('absolute');
  });
});

describe('<Backdrop /> clouds', () => {
  it('gives each backdrop its own cloud filter id', () => {
    const { container } = render(
      <>
        <Backdrop contained />
        <Backdrop contained />
      </>,
    );
    const ids = [...container.querySelectorAll('filter')].map((f) => f.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
