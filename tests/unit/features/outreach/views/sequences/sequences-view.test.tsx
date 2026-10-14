// tests/unit/features/outreach/views/sequences/sequences-view.test.tsx
/**
 * Sequences tab: the empty state holds the primary actions (and the header
 * hides them), and `?new=template` / `?new=1` open the editor, which closes
 * by stripping the param.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const search = { current: new URLSearchParams() };
const replace = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => search.current,
  useRouter: () => ({ replace, push }),
}));

const sequencesState = { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() };
vi.mock('@/features/outreach/hooks', () => ({
  useSequences: () => sequencesState,
  useOutreachMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/outreach/actions', () => ({ archiveSequenceAction: vi.fn(), deleteSequenceAction: vi.fn() }));

// Stub the editor: the real one is a large modal. The stub exposes the draft it was opened with.
vi.mock('@/features/outreach/views/sequences/sequence-editor', () => ({
  SequenceEditor: ({ initial, onClose }: { initial: { name: string; steps: unknown[] }; onClose: () => void }) => (
    <div role="dialog" aria-label="Sequence editor">
      <p>draft name: {initial.name}</p>
      <p>draft steps: {initial.steps.length}</p>
      <button type="button" onClick={onClose}>
        Close editor
      </button>
    </div>
  ),
}));

import { SequencesView } from '@/features/outreach/views/sequences-view';

beforeEach(() => {
  replace.mockClear();
  sequencesState.data = [];
  search.current = new URLSearchParams();
});

describe('Sequences empty state', () => {
  it('shows the primary actions once, inside the empty state, and hides the header buttons', () => {
    render(<SequencesView />);
    expect(screen.getAllByRole('button', { name: 'Start from a template' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'New sequence' })).toHaveLength(1);
  });

  it('opens a template-based editor from the empty-state primary action', () => {
    render(<SequencesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Start from a template' }));
    expect(screen.getByRole('dialog', { name: 'Sequence editor' })).toBeInTheDocument();
    expect(screen.getByText('draft name: Celebrant intro')).toBeInTheDocument();
  });

  it('opens a blank editor from the secondary action', () => {
    render(<SequencesView />);
    fireEvent.click(screen.getByRole('button', { name: 'New sequence' }));
    expect(screen.getByText('draft name:')).toBeInTheDocument();
    expect(screen.getByText('draft steps: 1')).toBeInTheDocument();
  });
});

describe('Sequences ?new= URL param', () => {
  it('opens the template editor for new=template', () => {
    search.current = new URLSearchParams('view=sequences&new=template');
    render(<SequencesView />);
    expect(screen.getByText('draft name: Celebrant intro')).toBeInTheDocument();
  });

  it('opens a blank editor for new=1', () => {
    search.current = new URLSearchParams('view=sequences&new=1');
    render(<SequencesView />);
    expect(screen.getByText('draft name:')).toBeInTheDocument();
    expect(screen.getByText('draft steps: 1')).toBeInTheDocument();
  });

  it('strips the param when the editor closes', () => {
    search.current = new URLSearchParams('view=sequences&new=template');
    render(<SequencesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(replace).toHaveBeenCalledWith('/admin/outreach?view=sequences');
    expect(screen.queryByRole('dialog', { name: 'Sequence editor' })).not.toBeInTheDocument();
  });

  it('does not touch the URL when the editor closes without a param', () => {
    render(<SequencesView />);
    fireEvent.click(screen.getByRole('button', { name: 'New sequence' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('Sequences with data', () => {
  it('keeps the header actions when sequences exist', () => {
    sequencesState.data = [
      { id: 's1', name: 'Intro', campaign_count: 0, steps: [] },
    ];
    render(<SequencesView />);
    expect(screen.getByRole('button', { name: 'New sequence' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start from a template' })).toBeInTheDocument();
  });
});
