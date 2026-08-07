/**
 * Roadmap voting list: seven candidate features, each with a seeded
 * community percentage and a progress bar. Clicking a card casts a
 * vote (highlight + its share ticks up 1%), clicking another card
 * moves the vote, clicking the same card again withdraws it.
 *
 * State is in-memory only (see `app/roadmap/page` module docs for why).
 *
 * @module app/roadmap/roadmap-voting
 */
'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import { displayedShare, ROADMAP_OPTIONS } from './roadmap-options';

export function RoadmapVoting() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {ROADMAP_OPTIONS.map((option) => {
        const selected = option.id === selectedId;
        const pct = displayedShare(option, selectedId);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => setSelectedId(selected ? null : option.id)}
            className={`w-full rounded-control border bg-card p-4 text-left transition-colors cursor-pointer ${
              selected
                ? 'border-brand-fg shadow-sm'
                : 'border-border hover:border-border-strong'
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border transition-colors ${
                  selected
                    ? 'border-brand-fg bg-brand-fg text-text-inverse'
                    : 'border-border bg-surface-muted text-text-muted'
                }`}
              >
                <option.icon size={16} strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium text-text">
                  {option.name}
                </span>
                <span className="block truncate text-body text-text-muted">
                  {option.description}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {selected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-brand-fg text-text-inverse animate-fade-in">
                    <Check size={12} strokeWidth={1.5} />
                  </span>
                )}
                <span className="w-10 text-right text-body font-semibold tabular-nums text-text">
                  {pct}%
                </span>
              </span>
            </span>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-pill bg-surface-emphasis">
              <span
                className="block h-full rounded-pill bg-brand-fg transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </span>
          </button>
        );
      })}
      <p className="pt-2 text-center text-body text-text-subtle">
        {selectedId
          ? 'Vote counted. You can change it any time.'
          : 'Tap an option to cast your vote.'}
      </p>
    </div>
  );
}
