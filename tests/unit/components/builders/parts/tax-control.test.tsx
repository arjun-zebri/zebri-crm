/**
 * Unit tests for TaxControl — popover-driven chip with a configurable
 * tax rate plus a "Prices include GST" display flag. The trigger reads
 * "Tax" (neutral), "GST X%", "GST X% incl.", or "GST incl." depending on
 * `rate` and `gstInclusive`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TaxControl } from '@/components/builders/parts/tax-control';

const noop = () => undefined;

describe('TaxControl', () => {
  it('renders the neutral "Tax" trigger when rate is null', () => {
    render(<TaxControl rate={null} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Add tax/i })).toHaveTextContent('Tax');
  });

  it('renders the applied "GST 10%" trigger when rate is 10', () => {
    render(<TaxControl rate={10} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Edit tax settings/i })).toHaveTextContent(
      'GST 10%',
    );
  });

  it('renders a custom rate label when rate differs from default', () => {
    render(<TaxControl rate={5} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Edit tax settings/i })).toHaveTextContent(
      'GST 5%',
    );
  });

  it('disables the trigger when canEdit=false', () => {
    render(<TaxControl rate={null} canEdit={false} onChange={noop} />);
    expect(screen.getByRole('button', { name: /Add tax/i })).toBeDisabled();
  });

  // Replaces an older test that asserted the trigger seeded 10% on the
  // first click. That seeding is gone on purpose: an MC opening the
  // popover only to tick "Prices include GST" must not silently acquire
  // a 10% GST line on the way in.
  it('does not apply a rate just from opening the popover', async () => {
    const onChange = vi.fn();
    render(<TaxControl rate={null} canEdit onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Add tax/i }));
    expect(screen.getByLabelText(/Tax rate percentage/i)).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the typed rate on Done', async () => {
    const onChange = vi.fn();
    render(<TaxControl rate={null} canEdit onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Add tax/i }));
    await userEvent.type(screen.getByLabelText(/Tax rate percentage/i), '10');
    await userEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('leaves the rate unset when Done is pressed with a blank field', async () => {
    const onChange = vi.fn();
    render(<TaxControl rate={null} canEdit onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Add tax/i }));
    await userEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  describe('Prices include GST', () => {
    it('hides the checkbox when no handler is supplied', async () => {
      render(<TaxControl rate={10} canEdit onChange={noop} />);
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      expect(
        screen.queryByRole('checkbox', { name: /Prices include GST/i }),
      ).not.toBeInTheDocument();
    });

    it('toggles the flag without touching the rate', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      render(
        <TaxControl
          rate={null}
          canEdit
          onChange={onChange}
          gstInclusive={false}
          onGstInclusiveChange={onGstInclusiveChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Add tax/i }));
      await userEvent.click(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      );
      expect(onGstInclusiveChange).toHaveBeenCalledWith(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('reads "GST incl." on the chip when the flag is on with no rate', () => {
      render(
        <TaxControl
          rate={null}
          canEdit
          onChange={noop}
          gstInclusive
          onGstInclusiveChange={noop}
        />,
      );
      expect(
        screen.getByRole('button', { name: /Edit tax settings/i }),
      ).toHaveTextContent('GST incl.');
    });

    it('reads "GST 10% incl." on the chip when both apply', () => {
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={noop}
          gstInclusive
          onGstInclusiveChange={noop}
        />,
      );
      expect(
        screen.getByRole('button', { name: /Edit tax settings/i }),
      ).toHaveTextContent('GST 10% incl.');
    });
  });
});
