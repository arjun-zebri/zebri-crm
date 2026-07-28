/**
 * Unit tests for the roadmap poll share math: seeds sum to 100 and
 * the +1/-1 vote rebalance keeps the total at 100 in every state.
 */
import { describe, expect, it } from 'vitest';

import {
  displayedShare,
  ROADMAP_OPTIONS,
} from '@/app/roadmap/roadmap-options';

const total = (selectedId: string | null) =>
  ROADMAP_OPTIONS.reduce((sum, o) => sum + displayedShare(o, selectedId), 0);

describe('ROADMAP_OPTIONS seeds', () => {
  it('sum to exactly 100', () => {
    expect(total(null)).toBe(100);
  });
});

describe('displayedShare', () => {
  it('returns the seed when nothing is selected', () => {
    for (const option of ROADMAP_OPTIONS) {
      expect(displayedShare(option, null)).toBe(option.seed);
    }
  });

  it('adds 1% to the voted option', () => {
    const pick = ROADMAP_OPTIONS[2]!;
    expect(displayedShare(pick, pick.id)).toBe(pick.seed + 1);
  });

  it('takes 1% from the highest-seeded other option', () => {
    // Voting for anything but the leader should shave the leader.
    const leader = ROADMAP_OPTIONS[0]!;
    const pick = ROADMAP_OPTIONS[3]!;
    expect(displayedShare(leader, pick.id)).toBe(leader.seed - 1);
  });

  it('takes from the runner-up when the leader itself is voted for', () => {
    const leader = ROADMAP_OPTIONS[0]!;
    const runnerUp = ROADMAP_OPTIONS[1]!;
    expect(displayedShare(leader, leader.id)).toBe(leader.seed + 1);
    expect(displayedShare(runnerUp, leader.id)).toBe(runnerUp.seed - 1);
  });

  it('keeps the total at 100 for every possible vote', () => {
    for (const option of ROADMAP_OPTIONS) {
      expect(total(option.id)).toBe(100);
    }
  });
});
