/**
 * Unit coverage for the UnderlineTabs primitive: the navigation landmark,
 * the active-tab contract (aria-current) and change reporting.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UnderlineTabs } from '@/components/ui/underline-tabs';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'checks', label: 'Checks' },
  { id: 'settings', label: 'Settings' },
] as const;

describe('<UnderlineTabs />', () => {
  it('renders a labelled navigation landmark with one button per tab', () => {
    render(<UnderlineTabs tabs={[...TABS]} active="today" onChange={() => {}} ariaLabel="Outreach views" />);
    expect(screen.getByRole('navigation', { name: 'Outreach views' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks only the active tab as the current page', () => {
    render(<UnderlineTabs tabs={[...TABS]} active="checks" onChange={() => {}} ariaLabel="Views" />);
    expect(screen.getByRole('button', { name: 'Checks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('reports the id of the tab that was clicked', async () => {
    const onChange = vi.fn();
    render(<UnderlineTabs tabs={[...TABS]} active="today" onChange={onChange} ariaLabel="Views" />);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  it('reports a click on the already-active tab too, so callers can decide', async () => {
    const onChange = vi.fn();
    render(<UnderlineTabs tabs={[...TABS]} active="today" onChange={onChange} ariaLabel="Views" />);
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith('today');
  });
});
