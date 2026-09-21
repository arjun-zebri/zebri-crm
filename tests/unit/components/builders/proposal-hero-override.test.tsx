/**
 * Unit tests for ProposalHeroOverride (D3, R7): the builder's per-proposal
 * cover row. Only the embed-link + remove paths are exercised here; the
 * file-upload path goes through Supabase Storage and is covered by e2e.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProposalHeroOverride } from '@/components/builders/parts/proposal-hero-override';

describe('ProposalHeroOverride', () => {
  it('pasting a Vimeo link sets embedUrl', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProposalHeroOverride value={null} proposalId="p1" canEdit onChange={onChange} />);

    const input = screen.getByLabelText('Cover video link');
    await user.type(input, 'https://vimeo.com/123456789');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ embedUrl: 'https://vimeo.com/123456789' });
  });

  it('pasting a non-video link shows the error and does not update', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProposalHeroOverride value={null} proposalId="p1" canEdit onChange={onChange} />);

    const input = screen.getByLabelText('Cover video link');
    await user.type(input, 'https://example.com');
    await user.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(/YouTube or Vimeo/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Remove sets the override to null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProposalHeroOverride
        value={{ embedUrl: 'https://vimeo.com/123456789' }}
        proposalId="p1"
        canEdit
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
