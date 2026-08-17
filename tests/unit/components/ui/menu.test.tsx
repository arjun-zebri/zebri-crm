import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { MenuItem, MenuLabel, MenuPanel, MenuSeparator } from '@/components/ui/menu';

describe('<MenuPanel /> and <MenuItem />', () => {
  it('exposes the panel as a menu and its rows as menu items', () => {
    render(
      <MenuPanel>
        <MenuItem>Status</MenuItem>
        <MenuItem>Priority</MenuItem>
      </MenuPanel>,
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('activates on click', async () => {
    const onClick = vi.fn();
    render(<MenuItem onClick={onClick}>Status</MenuItem>);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Status' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not activate when disabled', async () => {
    const onClick = vi.fn();
    render(
      <MenuItem onClick={onClick} disabled>
        Status
      </MenuItem>,
    );

    await userEvent.click(screen.getByRole('menuitem', { name: 'Status' }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem')).toBeDisabled();
  });

  it('marks the selected row without relying on colour alone in the DOM', () => {
    render(<MenuItem selected>Status</MenuItem>);

    expect(screen.getByRole('menuitem')).toHaveClass('bg-surface-emphasis', 'font-medium');
  });

  it('tones a destructive row with the danger token, not a raw red', () => {
    render(<MenuItem destructive>Delete</MenuItem>);

    const item = screen.getByRole('menuitem');
    expect(item).toHaveClass('text-danger');
    expect(item.className).not.toMatch(/text-red-\d/);
  });

  it('renders a trailing slot alongside the label', () => {
    render(<MenuItem trailing={<span>12</span>}>Status</MenuItem>);

    expect(screen.getByRole('menuitem', { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('offers two densities that differ by padding, not type size', () => {
    const { rerender } = render(<MenuItem size="sm">Row</MenuItem>);
    expect(screen.getByRole('menuitem')).toHaveClass('px-2.5', 'py-1.5', 'text-body');

    rerender(<MenuItem size="md">Row</MenuItem>);
    expect(screen.getByRole('menuitem')).toHaveClass('px-3', 'py-2', 'text-body');
  });

  it('takes a fixed width rather than stretching to its parent', () => {
    // A plain block panel fills whatever it is dropped into, which made a
    // filter dropdown span the entire viewport.
    render(
      <div style={{ width: 900 }}>
        <MenuPanel>
          <MenuItem>Status</MenuItem>
        </MenuPanel>
      </div>,
    );

    expect(screen.getByRole('menu')).toHaveClass('w-56');
  });

  it('keeps a one-option menu the same width as a ten-option one', () => {
    const { rerender } = render(
      <MenuPanel>
        <MenuItem>test</MenuItem>
      </MenuPanel>,
    );
    const narrow = screen.getByRole('menu').className;

    rerender(
      <MenuPanel>
        {['Siobhan and George Fuller', 'Nathan and Penny Telker'].map((n) => (
          <MenuItem key={n}>{n}</MenuItem>
        ))}
      </MenuPanel>,
    );

    expect(screen.getByRole('menu').className).toBe(narrow);
  });

  it.each([
    ['sm', 'w-44'],
    ['md', 'w-56'],
    ['lg', 'w-72'],
    ['auto', 'w-max'],
  ] as const)('maps width=%s to %s', (width, expected) => {
    render(<MenuPanel width={width}>
      <MenuItem>Row</MenuItem>
    </MenuPanel>);

    expect(screen.getByRole('menu')).toHaveClass(expected);
  });

  it('renders separators and labels as non-interactive structure', () => {
    render(
      <MenuPanel>
        <MenuLabel>Group by</MenuLabel>
        <MenuItem>Status</MenuItem>
        <MenuSeparator />
      </MenuPanel>,
    );

    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('Group by')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });
});

describe('<MenuItem checked />', () => {
  it('is an ordinary menu row when `checked` is not given', () => {
    render(
      <MenuPanel>
        <MenuItem>Rename</MenuItem>
      </MenuPanel>,
    );
    const row = screen.getByRole('menuitem');
    expect(row).not.toHaveAttribute('aria-checked');
  });

  it('announces its own state when it is a checkbox row', () => {
    // For menus whose choices are independent (the run sheet's
    // audiences), where picking one must not clear the others.
    render(
      <MenuPanel>
        <MenuItem checked>Vendor contacts</MenuItem>
        <MenuItem checked={false}>Me</MenuItem>
      </MenuPanel>,
    );
    const rows = screen.getAllByRole('menuitemcheckbox');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('aria-checked', 'true');
    expect(rows[1]).toHaveAttribute('aria-checked', 'false');
  });
});
