'use client'

import { SpotifyTrackPicker } from '@/components/songs/spotify-track-picker'
import { useSongForm } from '@/components/songs/use-song-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

import type { PortalSong } from './use-portal-data'

/** Props for {@link SongModal}. */
export interface SongModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => void
  onDelete?: (() => void) | undefined
  /** The song being edited, or null to add one. */
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
}

/**
 * Add or edit one of a couple's songs from the client profile.
 *
 * Songs are picked from Spotify by default, so the MC gets the exact
 * recording and can play it before saving. Typing a title and artist by
 * hand stays available for songs Spotify does not have (a friend's live
 * performance, a bagpiper). An existing typed song opens in typed mode.
 */
export function SongModal({ isOpen, onClose, onSave, onDelete, song, categoryLabel, saving }: SongModalProps) {
  const form = useSongForm(song, isOpen)
  const { typed, setTyped, track, setTrack, title, setTitle, artist, setArtist, notes, setNotes, confirmDelete, setConfirmDelete, canSave } = form
  const save = () => onSave(form.values())

  const footer = (
    <div className="flex items-center justify-between gap-3">
      {song && onDelete ? (
        confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-body text-text-muted">Remove this song?</span>
            <Button variant="danger" onClick={onDelete} loading={saving}>Remove</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
        )
      ) : null}
      <div className="ml-auto flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={!canSave} loading={saving}>Save</Button>
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      layer="nested"
      title={song ? 'Edit song' : `Add ${categoryLabel} song`}
      footer={footer}
    >
      <div className="space-y-4">
        {typed ? (
          <div className="flex h-72 flex-col gap-4">
            <Input label="Song title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Can't Help Falling in Love" autoFocus />
            <Input label="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Optional" />
            <button type="button" onClick={() => setTyped(false)} className="self-start text-body text-text-muted transition hover:text-text">
              Search Spotify instead
            </button>
          </div>
        ) : (
          <SpotifyTrackPicker value={track} onChange={setTrack} onTypeInstead={() => setTyped(true)} />
        )}
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Start from the chorus" />
      </div>
    </Modal>
  )
}
