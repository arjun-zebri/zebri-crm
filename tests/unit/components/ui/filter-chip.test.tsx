/**
 * Unit tests for the FilterChip primitive.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterChip } from '@/components/ui/filter-chip';

describe('FilterChip', () => {
  it('renders the label and count', () => {
    render(<FilterChip label="Active" count={12} pressed={false} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: '12 Active' })).toBeInTheDocument();
  });

  it('reflects the pressed state with aria-pressed', () => {
    render(<FilterChip label="Active" pressed onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<FilterChip label="Active" pressed={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a pill with a pointer cursor and no raw colours', () => {
    render(<FilterChip label="Active" pressed={false} onClick={() => {}} />);
    const cls = screen.getByRole('button', { name: 'Active' }).className;
    expect(cls).toContain('rounded-pill');
    expect(cls).toContain('cursor-pointer');
    expect(cls).not.toMatch(/gray|\[#/);
  });
});
