/**
 * The read-only "Enquiry from" row on the couple overview.
 *
 * @module tests/unit/couples/couple-source-origin-row
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoupleSourceOriginRow } from '@/app/(dashboard)/couples/couple-source-origin-row';

describe('CoupleSourceOriginRow', () => {
  it('shows the host of the recorded origin', () => {
    render(<CoupleSourceOriginRow sourceOrigin="https://www.mc-site.com" />);
    expect(screen.getByText('Enquiry from')).toBeInTheDocument();
    expect(screen.getByText('www.mc-site.com')).toBeInTheDocument();
  });

  it('renders nothing when there is no origin', () => {
    const { container } = render(<CoupleSourceOriginRow sourceOrigin={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
