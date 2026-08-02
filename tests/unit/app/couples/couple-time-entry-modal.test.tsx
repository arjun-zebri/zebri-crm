import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoupleTimeEntryModal } from '@/app/(dashboard)/couples/couple-time-entry-modal';
import type { TimeEntry } from '@/types/time-tracking';

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
  setTimeCategoryColorAction: vi.fn(),
}));

const ENTRY: TimeEntry = {
  id: 'entry-1',
  couple_id: 'couple-1',
  // 10:00 to 11:00 local on 12 June 2026.
  started_at: new Date(2026, 5, 12, 10, 0, 0).toISOString(),
  ended_at: new Date(2026, 5, 12, 11, 0, 0).toISOString(),
  category_id: null,
  category_name: null,
  category_color: null,
  note: null,
  auto_stopped: false,
};

function renderModal(entry?: TimeEntry) {
  const onSave = vi.fn().mockResolvedValue(true);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CoupleTimeEntryModal
        isOpen
        onClose={vi.fn()}
        coupleId="couple-1"
        entry={entry}
        onSave={onSave}
        saving={false}
      />
    </QueryClientProvider>,
  );
  return { onSave };
}

const durationField = () => screen.getByLabelText('Duration', { exact: true });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

/** The single input a save posted, asserted present so tests can read it. */
function savedInput(onSave: ReturnType<typeof vi.fn>): {
  started_at: string;
  ended_at: string;
} {
  const input = onSave.mock.calls[0]?.[0];
  expect(input).toBeDefined();
  return input as { started_at: string; ended_at: string };
}

/** Minutes between the two instants a save posted. */
function savedMinutes(input: { started_at: string; ended_at: string }): number {
  return (Date.parse(input.ended_at) - Date.parse(input.started_at)) / 60_000;
}

describe('CoupleTimeEntryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for a duration, not a start and an end', () => {
    renderModal();
    expect(durationField()).toBeInTheDocument();
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End')).not.toBeInTheDocument();
  });

  it('cannot be saved until the duration reads as one', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(saveButton()).toBeDisabled();

    await user.type(durationField(), 'about an hour');
    expect(saveButton()).toBeDisabled();

    await user.clear(durationField());
    await user.type(durationField(), '1h 30m');
    expect(saveButton()).toBeEnabled();
  });

  it('saves a new entry as a pair of instants the duration apart', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(durationField(), '1h 30m');
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(savedMinutes(savedInput(onSave))).toBe(90);
  });

  it('seeds the field from the entry being edited', () => {
    renderModal(ENTRY);
    expect(durationField()).toHaveValue('1h');
  });

  it('moves only the end when a duration is corrected, never the start', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal(ENTRY);

    await user.click(screen.getByRole('button', { name: /More by 15 minutes/ }));
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = savedInput(onSave);
    expect(input.started_at).toBe(ENTRY.started_at);
    expect(savedMinutes(input)).toBe(75);
  });

  it('steps in quarter hours, snapping onto the grid', async () => {
    const user = userEvent.setup();
    renderModal();

    // From nothing, one press lands on the first stop rather than no-op.
    await user.click(screen.getByRole('button', { name: /More by 15 minutes/ }));
    expect(durationField()).toHaveValue('15m');

    await user.clear(durationField());
    await user.type(durationField(), '1h 7m');
    await user.click(screen.getByRole('button', { name: /Less by 15 minutes/ }));
    expect(durationField()).toHaveValue('1h');
  });

  it('normalises what was typed once the field loses focus', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(durationField(), '90');
    await user.tab();
    expect(durationField()).toHaveValue('1h 30m');
  });
});
