'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { SpotifyTrack } from '@/lib/spotify/client'
import { parseSpotifyTrackRef } from '@/lib/spotify/parse'

/** Wait this long after the last keystroke before searching. */
const DEBOUNCE_MS = 300

/** What {@link useSpotifySearch} hands the picker. */
export interface SpotifySearchState {
  tracks: SpotifyTrack[]
  /** A request for the current text is in flight (or waiting on the debounce). */
  searching: boolean
  /** Spotify could not be reached; the picker offers manual entry instead. */
  unavailable: boolean
  /** The text has been searched (so an empty `tracks` means "no matches"). */
  searched: boolean
}

/**
 * Debounced Spotify track search through `/api/spotify/search`.
 *
 * A pasted Spotify track link is looked up straight away, with no
 * debounce, because it is a complete answer rather than a partial word.
 *
 * @param query - Raw text from the search field.
 * @param portalToken - The couple's portal token when searching from the
 *   portal; omitted for a signed-in MC.
 */
export function useSpotifySearch(query: string, portalToken?: string): SpotifySearchState {
  const trimmed = query.trim()
  const isLink = parseSpotifyTrackRef(trimmed) !== null
  const [typedSettled, setTypedSettled] = useState(trimmed)

  useEffect(() => {
    if (isLink) return
    const timer = setTimeout(() => setTypedSettled(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed, isLink])

  const debounced = isLink ? trimmed : typedSettled

  const enabled = debounced.length >= 2
  const { data, isFetching, isError, isPlaceholderData } = useQuery({
    queryKey: ['spotify-search', debounced, portalToken ?? null],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    // Keep the last results on screen while the next keystroke's search
    // runs, so the list refines instead of flashing empty.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced })
      if (portalToken) params.set('portal_token', portalToken)
      const res = await fetch(`/api/spotify/search?${params.toString()}`, { signal })
      if (!res.ok) throw new Error(`search ${res.status}`)
      const body = (await res.json()) as { tracks: SpotifyTrack[] }
      return body.tracks
    },
  })

  return {
    tracks: enabled ? (data ?? []) : [],
    searching: enabled && (isFetching || debounced !== trimmed),
    unavailable: enabled && isError,
    searched: enabled && data !== undefined && !isPlaceholderData && debounced === trimmed,
  }
}
