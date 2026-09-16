import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ProposalReadiness,
  readinessChecks,
} from '@/components/builders/parts/proposal-readiness';

const form = {
  coupleId: 'c1',
  title: 'Anna & Jake',
  contractTemplateId: 't1',
  options: [{ id: 'o1', items: [{ id: 'i1' }] }],
};

describe('proposal readiness', () => {
  it('is ready when couple, title, an option, and a template are set', () => {
    expect(readinessChecks(form).every((c) => c.ok)).toBe(true);
  });

  it('flags each missing piece', () => {
    const checks = readinessChecks({ ...form, coupleId: null, contractTemplateId: null, options: [] });
    const byKey = Object.fromEntries(checks.map((c) => [c.key, c.ok]));
    expect(byKey).toEqual({ couple: false, title: true, option: false, contractTemplate: false });
  });

  it('renders a line per check with its state', () => {
    render(<ProposalReadiness form={{ ...form, contractTemplateId: null }} />);
    expect(screen.getByText('Contract template chosen')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
