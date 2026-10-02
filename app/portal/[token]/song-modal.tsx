'use client'

import { Trash2 } from 'lucide-react'

import { useSongForm } from '@/components/songs/use-song-form'
import { BusyLabel } from '@/components/ui/busy-label'
import { Modal } from '@/components/ui/modal'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'

import type { PortalSong } from './page'
import { PortalSpotifyPicker } from './song-spotify-picker'
import { fieldStyle, primaryButtonStyle, roleText, secondaryButtonStyle } from './song-styles'

/** Props for {@link PortalSongModal}. */
export interface PortalSongModalProps {
  token: string
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => Promise<void>
  onDelete?: (() => Promise<void>) | undefined
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
  branding: PublicBranding
}

/**
 * The couple's add / edit song form on the portal. Spotify search first,
 * typed title and artist as the fallback; an existing typed song opens in
 * typed mode.
 */
export function PortalSongModal(props: PortalSongModalProps) {
  const { token, isOpen, onClose, onSave, onDelete, song, categoryLabel, saving, branding } = props
  const form = useSongForm(song, isOpen)
  const { typed, setTyped, track, setTrack, title, setTitle, artist, setArtist, notes, setNotes, confirmDelete, setConfirmDelete, canSave } = form
  const muted = roleText(branding, 'finePrint')
  const save = () => onSave(form.values())

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={song ? `Edit: ${categoryLabel}` : `Add song: ${categoryLabel}`}>
      <div className="space-y-4">
        {typed ? (
          <div className="flex h-72 flex-col gap-3">
            <label style={muted}>
              <span className="mb-1 block">Song title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Can't Help Falling in Love" style={fieldStyle(branding)} autoFocus />
            </label>
            <label style={muted}>
              <span className="mb-1 block">Artist (optional)</span>
              <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. Elvis Presley" style={fieldStyle(branding)} />
            </label>
            <button type="button" onClick={() => setTyped(false)} className="self-start transition cursor-pointer hover:opacity-75" style={muted}>
              Search Spotify instead
            </button>
          </div>
        ) : (
          <PortalSpotifyPicker token={token} value={track} onChange={setTrack} onTypeInstead={() => setTyped(true)} branding={branding} />
        )}
        <label className="block" style={muted}>
          <span className="mb-1 block">Notes (optional)</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Start from the chorus" style={fieldStyle(branding)} />
        </label>

        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${branding.border_color}` }}>
          {song && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2" style={muted}>
                <span>Remove this song?</span>
                <button type="button" onClick={async () => { await onDelete(); setConfirmDelete(false) }} className="transition cursor-pointer hover:opacity-80" style={{ color: STATUS_COLORS.error }}>
                  Yes, remove
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="transition cursor-pointer hover:opacity-80">
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 transition cursor-pointer hover:opacity-80" style={muted}>
                <Trash2 size={13} strokeWidth={1.5} />
                Remove
              </button>
            )
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 transition cursor-pointer hover:opacity-75" style={secondaryButtonStyle(branding)}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving || !canSave} className="px-3 py-1.5 transition cursor-pointer disabled:opacity-50 hover:opacity-90" style={primaryButtonStyle(branding)}>
              <BusyLabel busy={saving}>Save</BusyLabel>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
