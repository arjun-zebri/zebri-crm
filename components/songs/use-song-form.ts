'use client'

import { useState } from 'react'

import type { SpotifyTrack } from '@/lib/spotify/client'
import {
  NO_SPOTIFY_PICK,
  spotifyColumnsFor,
  trackFromSong,
  type SongSpotifyColumns,
} from '@/lib/spotify/song-fields'

/** The song fields both song forms read and write. */
export interface SongFormSong extends SongSpotifyColumns {
  title: string
  artist: string | null
  notes: string | null
}

/** What a song form hands to its `onSave`. */
export type SongFormValues = SongFormSong

/**
 * Form state shared by the MC and portal song modals.
 *
 * Songs are picked from Spotify by default; typed title and artist is the
 * fallback. An existing typed song opens in typed mode, an existing picked
 * song opens with its player showing.
 *
 * The form resets whenever the modal opens (or switches song). That reset
 * happens during render, not in an effect, so the first painted frame
 * already shows the right song rather than the previous one.
 *
 * @param song - The song being edited, or null to add one.
 * @param isOpen - Whether the modal is open.
 */
export function useSongForm(song: SongFormSong | null, isOpen: boolean) {
  const [opened, setOpened] = useState<{ isOpen: boolean; song: SongFormSong | null }>({ isOpen: false, song: null })
  const [typed, setTyped] = useState(false)
  const [track, setTrack] = useState<SpotifyTrack | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (opened.isOpen !== isOpen || opened.song !== song) {
    setOpened({ isOpen, song })
    if (isOpen) {
      const saved = song ? trackFromSong(song) : null
      setTrack(saved)
      setTyped(song !== null && saved === null)
      setTitle(song?.title ?? '')
      setArtist(song?.artist ?? '')
      setNotes(song?.notes ?? '')
      setConfirmDelete(false)
    }
  }

  const canSave = typed ? title.trim().length > 0 : track !== null

  /** The values to save. Typed entry clears any Spotify pick. */
  const values = (): SongFormValues => {
    const base = { notes: notes.trim() || null }
    if (typed || !track) return { ...base, title: title.trim(), artist: artist.trim() || null, ...NO_SPOTIFY_PICK }
    return { ...base, title: track.title, artist: track.artist || null, ...spotifyColumnsFor(track) }
  }

  return {
    typed, setTyped, track, setTrack, title, setTitle, artist, setArtist,
    notes, setNotes, confirmDelete, setConfirmDelete, canSave, values,
  }
}
