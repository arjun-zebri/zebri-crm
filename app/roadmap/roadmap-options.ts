/**
 * Roadmap poll data + share math, kept React-free so the vote
 * rebalancing logic is unit-testable on its own.
 *
 * @module app/roadmap/roadmap-options
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Handshake,
  Radio,
  Smartphone,
  Star,
  UsersRound,
  Video,
} from 'lucide-react';

/** A candidate feature on the public roadmap poll. */
export interface RoadmapOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Baseline community share in percent. All seeds sum to 100. */
  seed: number;
}

/** Poll options, ordered by seeded share so the page reads as a leaderboard. */
export const ROADMAP_OPTIONS: RoadmapOption[] = [
  {
    id: 'event-mode',
    name: 'Event Mode',
    description: 'A distraction-free live view for running the day of the wedding.',
    icon: Radio,
    seed: 24,
  },
  {
    id: 'pulse',
    name: 'Pulse (AI Sales Coach)',
    description: 'Reads your pipeline and tells you which enquiries need a nudge.',
    icon: Activity,
    seed: 19,
  },
  {
    id: 'video-calling',
    name: 'Video Calling',
    description: 'Run couple consults inside Zebri, auto-linked to their profile.',
    icon: Video,
    seed: 16,
  },
  {
    id: 'mobile-app',
    name: 'Mobile App',
    description: 'Zebri in your pocket, offline-ready for venues with no signal.',
    icon: Smartphone,
    seed: 15,
  },
  {
    id: 'vendor-network',
    name: 'Vendor Network',
    description: 'A shared directory of the photographers, planners and venues you work with.',
    icon: Handshake,
    seed: 11,
  },
  {
    id: 'review-engine',
    name: 'Review Engine',
    description: 'Automatically collect reviews and testimonials after the big day.',
    icon: Star,
    seed: 9,
  },
  {
    id: 'team-accounts',
    name: 'Team Accounts',
    description: 'Bring a second MC or an assistant into your workspace.',
    icon: UsersRound,
    seed: 6,
  },
];

/**
 * Display share for an option given the current vote.
 *
 * Voting adds 1% to the chosen option and takes 1% from the
 * highest-seeded *other* option, so the total always stays at 100
 * and withdrawing or moving a vote reverts cleanly (the result is
 * derived from seeds, never accumulated).
 */
export function displayedShare(
  option: RoadmapOption,
  selectedId: string | null,
  options: RoadmapOption[] = ROADMAP_OPTIONS,
): number {
  if (!selectedId) return option.seed;
  if (option.id === selectedId) return option.seed + 1;
  const donor = options
    .filter((o) => o.id !== selectedId)
    .reduce((top, o) => (o.seed > top.seed ? o : top));
  return option.id === donor.id ? option.seed - 1 : option.seed;
}
