/**
 * API access section: endpoint + token copy rows, docs link, AI prompt copy.
 *
 * @module tests/unit/settings/api-access-section
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiAccessSection } from '@/app/(dashboard)/settings/lead-capture/api-access-section';

describe('ApiAccessSection', () => {
  it('renders the endpoint, the token, the docs link and the prompt button', () => {
    render(
      <ApiAccessSection
        origin="https://app.zebri.com.au"
        token="11111111-1111-4111-8111-111111111111"
        allowedOrigins={[]}
        onAllowedOriginsChange={vi.fn(async () => null)}
      />,
    );
    expect(screen.getByRole('heading', { name: /build your own form/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Endpoint')).toHaveValue('https://app.zebri.com.au/api/lead/submit');
    expect(screen.getByLabelText('Form token')).toHaveValue('11111111-1111-4111-8111-111111111111');
    expect(screen.getByRole('link', { name: /read the docs/i })).toHaveAttribute(
      'href',
      '/docs/lead-capture-api',
    );
    // The AI prompt button was removed: the docs link is the one way out.
    expect(screen.queryByRole('button', { name: /ai prompt/i })).not.toBeInTheDocument();
  });
});
