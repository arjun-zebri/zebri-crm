// tests/unit/features/outreach/views/sequences/sequence-editing.test.tsx
/**
 * Sequence editing rules shown to the founder: which edits are blocked and
 * why, whether closing asks about unsaved work, and all save blockers.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { draftFromSequence, isDraftChanged, blankSequence } from '@/features/outreach/views/sequences/sequence-draft';
import { SaveBlockers } from '@/features/outreach/views/sequences/sequence-editor-chrome';
import { usageLabel, SequenceList } from '@/features/outreach/views/sequences/sequence-list';
import type { SequenceWithSteps } from '@/lib/outreach/services/queries';

const saved = {
  id: 'seq-1',
  name: 'Intro',
  campaign_count: 2,
  steps: [
    {
      id: 'st-1',
      sequence_id: 'seq-1',
      position: 1,
      channel: 'email',
      delay_days: 0,
      is_new_thread: true,
      sent_count: 5,
      variants: [{ id: 'v-1', step_id: 'st-1', label: 'A', subject: 'Hi', body: 'Hello', weight: 100, active: true, sent_count: 5 }],
    },
  ],
} as unknown as SequenceWithSteps;

describe('draftFromSequence', () => {
  it('carries the sent counts so the editor can block removals', () => {
    const draft = draftFromSequence(saved);
    expect(draft.steps[0]?.sentCount).toBe(5);
    expect(draft.steps[0]?.variants[0]?.sentCount).toBe(5);
  });
});

describe('isDraftChanged', () => {
  it('is false for an untouched draft and true after an edit', () => {
    const initial = blankSequence();
    const same = structuredClone(initial);
    expect(isDraftChanged(same, initial)).toBe(false);
    expect(isDraftChanged({ ...initial, name: 'New name' }, initial)).toBe(true);
  });
});

describe('usageLabel', () => {
  it('describes campaign usage in plain words', () => {
    expect(usageLabel(0)).toBe('Not used by a campaign yet');
    expect(usageLabel(1)).toBe('Used by 1 campaign');
    expect(usageLabel(2)).toBe('Used by 2 campaigns');
  });
});

describe('SequenceList', () => {
  it('explains why a sequence in use cannot be archived', () => {
    render(<SequenceList sequences={[saved]} onEdit={() => {}} onArchive={() => {}} />);
    expect(screen.getByText('Used by 2 campaigns. Remove it from those campaigns before you can archive it.')).toBeInTheDocument();
  });
});

describe('SaveBlockers', () => {
  it('lists every problem, not just the first', () => {
    render(<SaveBlockers problems={['Name the sequence.', 'Step 1 has an empty message.']} />);
    expect(screen.getByText('Name the sequence.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 has an empty message.')).toBeInTheDocument();
  });

  it('renders nothing when there are no problems', () => {
    const { container } = render(<SaveBlockers problems={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
