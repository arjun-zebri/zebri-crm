'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { isQuestion } from '@/components/ui-v2/field';
import { MusicIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { findSongs, SONGS, songText, type Song } from './song-list';

/**
 * A song question's answer: search by title or artist, pick one from
 * the list that drops under the field, and it shows as the song with a
 * cover square, with Change to search again. The preview searches a
 * small list (`song-list.ts`); the real one searches Spotify. Results
 * sit in the flow, not a floating menu, so they never fight the dialog
 * they are in.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/fields/song-search
 */

const COVER: Record<Song['tone'], string> = {
  grass: 'bg-grass-100 text-grass-800',
  champagne: 'bg-champagne-100 text-champagne-800',
  zebra: 'bg-zebra-100 text-zebra-700',
};

/** A song with its cover square. */
function SongLine({ song }: { song: Song }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-check ${COVER[song.tone]}`}>
        <MusicIcon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate type-body text-zebra-950">{song.title}</span>
        <span className="block truncate type-body text-zebra-500">{song.artist}</span>
      </span>
    </span>
  );
}

export interface SongSearchProps {
  label: string;
  /** "Perfect, Ed Sheeran", or empty. */
  value: string;
  onChange: (value: string) => void;
}

/** The song search. See {@link SongSearchProps}. */
export function SongSearch({ label, value, onChange }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const name = label || 'Song';
  const picked = SONGS.find((s) => songText(s) === value);
  if (value && !query)
    return (
      <div>
        {/* A question keeps its wording in view once answered, as `Field` shows it. */}
        {isQuestion(name) ? <p className="mb-1 type-body text-zebra-500">{name}</p> : null}
        <div className="flex items-center justify-between gap-3">
          {picked ? <SongLine song={picked} /> : <span className="type-body text-zebra-950">{value}</span>}
          <Button variant="plain" onClick={() => onChange('')}>
            Change
          </Button>
        </div>
      </div>
    );
  const found = findSongs(query);
  return (
    <div className="space-y-1">
      {/* A short name ("First dance") is the placeholder; a question shows above, and the search says what to type. */}
      <Input
        type="search"
        icon={MusicIcon}
        label={name}
        placeholder={isQuestion(name) ? 'Search for a song or artist' : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() ? (
        <ul className="-mx-2">
          {found.map((s) => (
            <li key={songText(s)}>
              <button
                type="button"
                onClick={() => (onChange(songText(s)), setQuery(''))}
                className={`w-full rounded-button px-2 py-1.5 ${ROW}`}
              >
                <SongLine song={s} />
              </button>
            </li>
          ))}
          {found.length === 0 ? (
            <li>
              <button
                type="button"
                onClick={() => (onChange(query.trim()), setQuery(''))}
                className={`w-full rounded-button px-2 py-2 text-left type-body text-zebra-600 ${ROW}`}
              >
                Use “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
