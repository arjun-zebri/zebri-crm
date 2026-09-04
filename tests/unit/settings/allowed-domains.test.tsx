/**
 * Allowed domains list: add with validation, remove, save through onChange.
 *
 * @module tests/unit/settings/allowed-domains
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AllowedDomains } from '@/app/(dashboard)/settings/lead-capture/allowed-domains';

describe('AllowedDomains', () => {
  it('shows the empty state and adds a normalised origin', async () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    expect(screen.getByText(/cannot post from a browser/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'HTTPS://WWW.Example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://www.example.com']));
  });

  it('shows a validation error inline and does not save', () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'https://x.com/path' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no path/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a row', async () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={['https://a.com', 'https://b.com']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove https:\/\/a\.com/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://b.com']));
  });

  it('surfaces a server error from onChange', async () => {
    const onChange = vi.fn(async () => 'Up to 20 domains.');
    render(<AllowedDomains origins={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'https://a.com' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/up to 20/i));
  });

  it('ignores a second remove click while the first save is still pending', async () => {
    let resolveChange: (value: string | null) => void = () => {};
    const pending = new Promise<string | null>((resolve) => {
      resolveChange = resolve;
    });
    const onChange = vi.fn(() => pending);
    render(<AllowedDomains origins={['https://a.com', 'https://b.com']} onChange={onChange} />);
    const removeButton = screen.getByRole('button', { name: /remove https:\/\/a\.com/i });
    fireEvent.click(removeButton);
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledTimes(1);
    resolveChange(null);
    await waitFor(() => expect(removeButton).not.toBeDisabled());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears a previous error after a successful remove', async () => {
    const onChange = vi.fn(async () => null);
    render(<AllowedDomains origins={['https://a.com']} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: /add domain/i }), { target: { value: 'https://x.com/path' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no path/i);
    fireEvent.click(screen.getByRole('button', { name: /remove https:\/\/a\.com/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
