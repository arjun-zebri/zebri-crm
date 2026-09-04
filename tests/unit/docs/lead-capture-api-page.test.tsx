/**
 * The docs page renders every part of the contract from the reference data.
 *
 * @module tests/unit/docs/lead-capture-api-page
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LeadCaptureApiDocsPage from '@/app/docs/lead-capture-api/page';
import { LEAD_API_ERRORS, LEAD_PAYLOAD_KEYS } from '@/lib/lead-capture/api-reference';

describe('/docs/lead-capture-api', () => {
  it('lists the endpoints, every payload key and every error code', () => {
    render(<LeadCaptureApiDocsPage />);
    expect(screen.getByRole('heading', { level: 1, name: /lead capture api/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\/api\/lead\/submit/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\/api\/lead\/config/).length).toBeGreaterThan(0);
    for (const k of LEAD_PAYLOAD_KEYS) expect(screen.getAllByText(new RegExp(k.key)).length).toBeGreaterThan(0);
    for (const e of LEAD_API_ERRORS) expect(screen.getAllByText(new RegExp(e.code)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy example/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llms\.txt/i })).toHaveAttribute('href', '/llms.txt');
  });
});
