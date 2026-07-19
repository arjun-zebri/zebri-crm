/**
 * Unit tests for `ContactDetailsCard` (portal Overview).
 *
 * - Renders the quiet subheading label.
 * - Editing a field and blurring commits the full triple via `onSave`.
 * - Blurring an untouched field does NOT commit (no redundant writes).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { ContactDetailsCard, type ContactTriple } from '@/app/portal/[token]/contact-details-card';

const empty: ContactTriple = { name: '', email: '', phone: '' };
const mockBranding = buildPublicBranding({});

describe('ContactDetailsCard', () => {
  it('renders the subheading label', () => {
    render(<ContactDetailsCard label="Primary contact" value={empty} onSave={vi.fn()} branding={mockBranding} />);
    expect(screen.getByText('Primary contact')).toBeInTheDocument();
  });

  it('commits the full triple on blur after a change', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ContactDetailsCard label="Primary contact" value={empty} onSave={onSave} branding={mockBranding} />);
    await user.type(screen.getByLabelText('Name'), 'Alex');
    await user.tab(); // blur
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ name: 'Alex', email: '', phone: '' });
  });

  it('does not commit when a field is blurred without changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ContactDetailsCard
        label="Primary contact"
        value={{ name: 'Alex', email: '', phone: '' }}
        onSave={onSave}
        branding={mockBranding}
      />,
    );
    await user.click(screen.getByLabelText('Name'));
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();
  });
});
