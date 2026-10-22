// tests/unit/features/outreach/views/checks/checks-steps.test.tsx
/**
 * Import wizard copy: the columns are listed up front, the preview explains
 * each count, and a file that cannot be read gets a friendly message.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ImportFileStep } from '@/features/outreach/views/checks/import-file-step';
import { ImportPreviewStep } from '@/features/outreach/views/checks/import-preview-step';

describe('ImportFileStep', () => {
  it('lists the required name rule and the optional columns', () => {
    render(<ImportFileStep onChoose={vi.fn()} loading={false} />);
    expect(screen.getByText(/Required: a Full name column, or both First name and Last name/)).toBeInTheDocument();
    expect(screen.getByText(/Registration number, State, Suburb/)).toBeInTheDocument();
    expect(screen.getByText(/File > Download > CSV/)).toBeInTheDocument();
  });

  it('shows a friendly message instead of the raw error when the file cannot be read', async () => {
    const onChoose = vi.fn();
    render(<ImportFileStep onChoose={onChoose} loading={false} />);
    const input = screen.getByLabelText('Choose CSV file');
    const unreadable = { text: () => Promise.reject(new DOMException('NotReadableError')) };
    fireEvent.change(input, { target: { files: [unreadable] } });
    expect(await screen.findByText(/We couldn't read that file/)).toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('passes the file text on when it reads', async () => {
    const onChoose = vi.fn();
    render(<ImportFileStep onChoose={onChoose} loading={false} />);
    const file = { text: () => Promise.resolve('Full name\nJane Doe') };
    fireEvent.change(screen.getByLabelText('Choose CSV file'), { target: { files: [file] } });
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith('Full name\nJane Doe'));
  });
});

describe('ImportPreviewStep', () => {
  it('explains Skipped, the merge rule and the dedupe key', () => {
    render(<ImportPreviewStep counts={{ newCount: 4, mergeCount: 2, skipped: 3, skippedNoName: 1 }} />);
    expect(screen.getByText('Rows with no name, or a repeat of a celebrant earlier in the same sheet.')).toBeInTheDocument();
    expect(screen.getByText(/Only blank fields are filled in, so some may not change/)).toBeInTheDocument();
    expect(screen.getByText(/matched by registration number when they have one/)).toBeInTheDocument();
    expect(screen.getByText(/existing values are never overwritten/)).toBeInTheDocument();
    expect(screen.getByText('1 row has no name, and 2 are repeats.')).toBeInTheDocument();
  });

  it('says only repeats when no row lacks a name', () => {
    render(<ImportPreviewStep counts={{ newCount: 1, mergeCount: 0, skipped: 1, skippedNoName: 0 }} />);
    expect(screen.getByText('1 row is a repeat of a celebrant earlier in the sheet.')).toBeInTheDocument();
  });
});
