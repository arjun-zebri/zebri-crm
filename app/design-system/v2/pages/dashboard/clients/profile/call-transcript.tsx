'use client';

import { Search } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui-v2/input';

import type { TranscriptLine } from './calls-data';

/**
 * A call's transcript, the other half of its notes: who said what and when, with a
 * search box that marks every match and hides the lines without one.
 * The quote icon on an update scrolls its line into view and tints
 * it, so every update and detail can be checked against the words.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-transcript
 */

export interface CallTranscriptProps {
  lines: TranscriptLine[];
  /** The line to show; `n` changes on every jump, so the same line can be shown twice. */
  focus: { line: string; n: number } | null;
}

/** The transcript. See {@link CallTranscriptProps}. */
export function CallTranscript({ lines, focus }: CallTranscriptProps) {
  // A jump must not land on a line the search is hiding, so a search typed
  // before the latest jump no longer applies (`at` is the jump it followed).
  const [search, setSearch] = useState({ text: '', at: 0 });
  const query = focus && focus.n > search.at ? '' : search.text;
  const refs = useRef(new Map<string, HTMLLIElement>());
  const q = query.trim().toLowerCase();
  const shown = q ? lines.filter((l) => `${l.who} ${l.text}`.toLowerCase().includes(q)) : lines;
  useEffect(() => {
    if (!focus) return;
    // After the first paint. Instant, not smooth: a jump arrives as the
    // transcript mounts, and a smooth scroll started then was cut short.
    const id = window.requestAnimationFrame(() =>
      refs.current.get(focus.line)?.scrollIntoView({ block: 'center' }),
    );
    return () => window.cancelAnimationFrame(id);
  }, [focus]);
  return (
    <section aria-label="Transcript" className="space-y-4">
      {/* Pinned, so the search stays in reach down a long call. -mt-8 pt-8
          meets the panel's top padding, so lines never show above it. */}
      <div className="sticky -top-8 z-10 -mt-8 space-y-4 bg-field pb-2 pt-8">
        <Input
          aria-label="Search the transcript"
          placeholder="Search what was said"
          type="search"
          value={query}
          onChange={(e) => setSearch({ text: e.target.value, at: focus?.n ?? 0 })}
          leading={<Search aria-hidden="true" strokeWidth={1.5} className="size-4" />}
        />
      </div>
      <ol className="-mx-3 space-y-1">
        {shown.map((l) => (
          <li
            key={l.id}
            ref={(el) => {
              if (el) refs.current.set(l.id, el);
              else refs.current.delete(l.id);
            }}
            className={`rounded-button px-3 py-2 type-body transition-colors duration-500 motion-reduce:transition-none ${
              focus?.line === l.id ? 'bg-grass-50' : ''
            }`}
          >
            <p className="flex items-baseline gap-2">
              <span className={`type-label ${l.you ? 'text-zebra-500' : 'text-zebra-950'}`}>{l.who}</span>
              <span className="tabular-nums text-zebra-400">{l.at}</span>
            </p>
            <p className="text-zebra-700">
              <Marked text={l.text} q={q} />
            </p>
          </li>
        ))}
        {shown.length ? null : <li className="px-3 py-6 type-body text-zebra-400">Nobody said that.</li>}
      </ol>
    </section>
  );
}

/** The text with every match of `q` marked. */
function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q ? (
          <mark key={i} className="rounded-check bg-grass-100 text-zebra-950">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

