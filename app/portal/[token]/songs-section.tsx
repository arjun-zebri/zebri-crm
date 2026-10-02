'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useCallback, useState } from 'react'

import type { PublicBranding } from '@/lib/branding/public-surface'

import type { PortalSong, PortalSongCategory } from './page'
import { SongCategoryGroup } from './song-category-group'
import { PortalSongModal } from './song-modal'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

const DEFAULT_SONG_CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: 'entry_partner1', label: 'Partner 1 Entry', description: 'Song playing as Partner 1 enters' },
  { key: 'entry_partner2', label: 'Partner 2 Entry', description: 'Song playing as Partner 2 enters' },
  { key: 'first_dance', label: 'First Dance', description: 'Your first dance as a married couple' },
  { key: 'bridal_party_entry', label: 'Bridal Party Entry', description: 'Song for bridal party walk-in' },
  { key: 'ceremony', label: 'Ceremony', description: 'Other ceremony music' },
  { key: 'reception', label: 'Reception', description: 'Reception and dancing music' },
  { key: 'avoid', label: 'Do Not Play', description: "Songs you definitely don't want played" },
]

interface SongsSectionProps {
  token: string
  initialSongs: PortalSong[]
  initialCategories: PortalSongCategory[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * The couple's songs on their portal: one group per category, and the
 * add / edit modal (Spotify search or typed). Writes go through the
 * token-gated `save_portal_song` / `delete_portal_song` RPCs.
 */
export function SongsSection({ token, initialSongs, initialCategories, branding }: SongsSectionProps) {
  const categories = initialCategories.length > 0 ? initialCategories : DEFAULT_SONG_CATEGORIES
  const [songs, setSongs] = useState<PortalSong[]>(initialSongs)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSong, setEditingSong] = useState<PortalSong | null>(null)
  const [modalCategory, setModalCategory] = useState(categories[0]!)
  const [saving, setSaving] = useState(false)

  const openAdd = (category: (typeof categories)[number]) => {
    setEditingSong(null)
    setModalCategory(category)
    setModalOpen(true)
  }

  const openEdit = (song: PortalSong) => {
    setEditingSong(song)
    setModalCategory(categories.find((c) => c.key === song.category) ?? categories[0]!)
    setModalOpen(true)
  }

  const close = () => {
    setModalOpen(false)
    setEditingSong(null)
  }

  const handleSave = useCallback(async (data: Partial<PortalSong>) => {
    setSaving(true)
    const next: PortalSong = editingSong
      ? { ...editingSong, ...data }
      : {
          id: crypto.randomUUID(),
          category: modalCategory.key,
          title: data.title ?? '',
          artist: data.artist ?? null,
          notes: data.notes ?? null,
          position: songs.filter((s) => s.category === modalCategory.key).length * 1000,
          spotify_track_id: data.spotify_track_id ?? null,
          artwork_url: data.artwork_url ?? null,
          duration_ms: data.duration_ms ?? null,
        }
    setSongs((prev) => (editingSong ? prev.map((s) => (s.id === next.id ? next : s)) : [...prev, next]))
    await anonSupabase().rpc('save_portal_song', {
      p_token: token,
      p_id: next.id,
      p_category: next.category,
      p_title: next.title,
      p_artist: next.artist ?? null,
      p_notes: next.notes ?? null,
      p_position: next.position,
      p_spotify_track_id: next.spotify_track_id,
      p_artwork_url: next.artwork_url,
      p_duration_ms: next.duration_ms,
    })
    setSaving(false)
    close()
  }, [editingSong, modalCategory, songs, token])

  const handleDelete = useCallback(async () => {
    if (!editingSong) return
    setSaving(true)
    setSongs((prev) => prev.filter((s) => s.id !== editingSong.id))
    await anonSupabase().rpc('delete_portal_song', { p_token: token, p_id: editingSong.id })
    setSaving(false)
    close()
  }, [editingSong, token])

  return (
    <div className="space-y-8">
      {categories.map((cat) => (
        <SongCategoryGroup key={cat.key} category={cat} songs={songs} onAdd={() => openAdd(cat)} onEdit={openEdit} branding={branding} />
      ))}

      <PortalSongModal
        token={token}
        isOpen={modalOpen}
        onClose={close}
        onSave={handleSave}
        onDelete={editingSong ? handleDelete : undefined}
        song={editingSong}
        categoryLabel={modalCategory.label}
        saving={saving}
        branding={branding}
      />
    </div>
  )
}
