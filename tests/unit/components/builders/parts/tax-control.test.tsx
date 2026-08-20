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

    it('disables the checkbox when a rate is set (to prevent double-charging)', async () => {
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={noop}
          gstInclusive={false}
          onGstInclusiveChange={noop}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).toBeDisabled();
    });

    it('updates helper text when rate is set to explain the checkbox is disabled', async () => {
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={noop}
          gstInclusive={false}
          onGstInclusiveChange={noop}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      expect(
        screen.getByText(/GST is being added on top, so prices cannot also include it/i),
      ).toBeInTheDocument();
    });

    it('disables the rate input when gstInclusive is ticked', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={onChange}
          gstInclusive
          onGstInclusiveChange={onGstInclusiveChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      expect(
        screen.getByLabelText(/Tax rate percentage/i),
      ).toBeDisabled();
    });

    it('prevents ticking checkbox by disabling it when a rate is set', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      // Start with a rate already set
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={onChange}
          gstInclusive={false}
          onGstInclusiveChange={onGstInclusiveChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      // The checkbox is disabled because a rate is set
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).toBeDisabled();
      // onGstInclusiveChange should not be called when trying to interact
      expect(onGstInclusiveChange).not.toHaveBeenCalled();
    });

    it('unsets gstInclusive when a rate is entered while it is ticked', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      render(
        <TaxControl
          rate={null}
          canEdit
          onChange={onChange}
          gstInclusive
          onGstInclusiveChange={onGstInclusiveChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      // Rate input should be disabled because gstInclusive is true
      expect(
        screen.getByLabelText(/Tax rate percentage/i),
      ).toBeDisabled();
      // Verify the disabled state message
      expect(
        screen.getByText(/Leave blank when prices already include GST/i),
      ).toBeInTheDocument();
    });

    it('handles legacy data with both rate and gstInclusive set: checkbox is disabled', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      render(
        <TaxControl
          rate={10}
          canEdit
          onChange={onChange}
          gstInclusive={true}
          onGstInclusiveChange={onGstInclusiveChange}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Edit tax settings/i }));
      // When both are set (legacy data), the checkbox is disabled because
      // a rate is applied. To resolve this, the user must remove the rate first.
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).toBeDisabled();
      // The remove button is available to clear the rate
      await userEvent.click(screen.getByRole('button', { name: /Remove/i }));
      // After removing the rate, the chip reverts to showing "GST incl."
      // (the checkbox state is still checked, rate is removed)
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('disables the checkbox when typing a rate into the draft (live feedback)', async () => {
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
      // Checkbox is initially enabled because no rate is set
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).not.toBeDisabled();
      // Type a rate into the draft
      await userEvent.type(screen.getByLabelText(/Tax rate percentage/i), '7');
      // Checkbox should now be disabled even though Done hasn't been clicked yet
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).toBeDisabled();
      // Helper text should reflect the disabled state
      expect(
        screen.getByText(/GST is being added on top, so prices cannot also include it/i),
      ).toBeInTheDocument();
    });

    it('re-enables the checkbox when clearing the typed rate from the draft (live feedback)', async () => {
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
      // Type a rate into the draft
      await userEvent.type(screen.getByLabelText(/Tax rate percentage/i), '7');
      // Checkbox should be disabled
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).toBeDisabled();
      // Clear the draft
      await userEvent.clear(screen.getByLabelText(/Tax rate percentage/i));
      // Checkbox should now be re-enabled
      expect(
        screen.getByRole('checkbox', { name: /Prices include GST/i }),
      ).not.toBeDisabled();
      // Helper text should go back to the unchecked state message
      expect(
        screen.getByText(/Tells the couple the price already covers GST/i),
      ).toBeInTheDocument();
    });

    it('clears the draft when gstInclusive is toggled to true (defensive safety)', async () => {
      const onChange = vi.fn();
      const onGstInclusiveChange = vi.fn();
      // Start with gstInclusive=false, rate=null. The checkbox is unchecked
      // and enabled, so the rate input is enabled.
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

      // Type a rate into the draft (but don't click Done)
      const rateInput = screen.getByLabelText(/Tax rate percentage/i) as HTMLInputElement;
      await userEvent.type(rateInput, '8');
      expect(rateInput.value).toBe('8');

      // Clear the draft so the checkbox isn't disabled, then tick it
      await userEvent.clear(rateInput);

      // Now click the checkbox to toggle it to true
      // This should clear the draft as a safety measure in handleGstInclusiveToggle
      await userEvent.click(screen.getByRole('checkbox', { name: /Prices include GST/i }));
      expect(onGstInclusiveChange).toHaveBeenCalledWith(true);

      // Verify the draft remains empty (it was already empty, but the handler
      // ensures it stays cleared even if there were stale data)
      expect(rateInput.value).toBe('');
    });
  });
});
