/**
 * /roadmap: "What should we build next?" community voting page.
 *
 * Standalone page (no dashboard shell, not linked from the sidebar).
 * Votes are client-side only for now: refreshing resets the poll,
 * which is deliberate. The page doubles as the intro video's
 * "You decide" scene and needs to reset cleanly between takes.
 * A persisted (DB + RLS) version replaces this when voting goes live.
 *
 * @module app/roadmap/page
 */
import type { Metadata } from 'next';
import Image from 'next/image';

import { RoadmapVoting } from './roadmap-voting';

export const metadata: Metadata = { title: 'Roadmap · Zebri' };

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-surface-muted px-4 py-16">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-4 text-center">
          <Image
            src="/zebri-logo.svg"
            alt="Zebri"
            width={80}
            height={29}
            className="mx-auto"
            priority
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-text">
              What should we build next?
            </h1>
            <p className="text-sm text-text-muted">
              Zebri&apos;s roadmap is decided by the people who use it.
              One vote per MC. Pick the feature you want most.
            </p>
          </div>
        </header>
        <RoadmapVoting />
      </div>
    </main>
  );
}
