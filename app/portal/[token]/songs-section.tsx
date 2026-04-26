'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Music, Pencil } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Modal } from '@/components/ui/modal'
import type { PortalSong, PortalSongCategory } from './page'

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

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

interface SongModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => Promise<void>
  onDelete?: () => Promise<void>
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
}

function SongModal({ isOpen, onClose, onSave, onDelete, song, categoryLabel, saving }: SongModalProps) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [notes, setNotes] = useState(song?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle(song?.title ?? '')
      setArtist(song?.artist ?? '')
      setNotes(song?.notes ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, song])

  const handleSubmit = async () => {
    await onSave({ title, artist: artist || null, notes: notes || null })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={song ? `Edit: ${categoryLabel}` : `Add song: ${categoryLabel}`}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Song title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Can't Help Falling in Love"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Artist (optional)</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Elvis Presley"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Start from the chorus"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {song && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this song?</span>
                <button
                  type="button"
                  onClick={async () => { await onDelete(); setConfirmDelete(false) }}
                  className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer"
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition cursor-pointer"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                Remove
              </button>
            )
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

interface CategoryGroupProps {
  category: { key: string; label: string; description: string | null }
  songs: PortalSong[]
  onAdd: () => void
  onEdit: (song: PortalSong) => void
}

function CategoryGroup({ category, songs, onAdd, onEdit }: CategoryGroupProps) {
  const categorySongs = songs.filter((s) => s.category === category.key)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{category.label}</p>
          <p className="text-sm text-gray-400">{category.description}</p>
        </div>
        <button
          onClick={onAdd}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition cursor-pointer shrink-0"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add
        </button>
      </div>

      {categorySongs.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-3.5 flex items-center justify-center gap-1.5">
          <Music size={14} strokeWidth={1.5} className="text-gray-300" />
          <span className="text-sm text-gray-300">No songs yet</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {categorySongs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-3.5 bg-white hover:border-gray-300 hover:bg-gray-50/50 transition cursor-pointer"
              onClick={() => onEdit(s)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500">
                  {[s.artist, s.notes].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Pencil size={13} strokeWidth={1.5} className="text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface SongsSectionProps {
  token: string
  initialSongs: PortalSong[]
  initialCategories: PortalSongCategory[]
}

export function SongsSection({ token, initialSongs, initialCategories }: SongsSectionProps) {
  const categories = initialCategories.length > 0 ? initialCategories : DEFAULT_SONG_CATEGORIES
  const [songs, setSongs] = useState<PortalSong[]>(initialSongs)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSong, setEditingSong] = useState<PortalSong | null>(null)
  const [modalCategory, setModalCategory] = useState(categories[0])
  const [saving, setSaving] = useState(false)

  const openAdd = (category: typeof categories[0]) => {
    setEditingSong(null)
    setModalCategory(category)
    setModalOpen(true)
  }

  const openEdit = (song: PortalSong) => {
    setEditingSong(song)
    setModalCategory(categories.find((c) => c.key === song.category) ?? categories[0])
    setModalOpen(true)
  }

  const handleSave = useCallback(async (data: Partial<PortalSong>) => {
    setSaving(true)
    const supabase = anonSupabase()

    if (editingSong) {
      const merged = { ...editingSong, ...data }
      setSongs((prev) => prev.map((s) => (s.id === merged.id ? merged : s)))
      await supabase.rpc('save_portal_song', {
        p_token: token,
        p_id: merged.id,
        p_category: merged.category,
        p_title: merged.title,
        p_artist: merged.artist ?? null,
        p_notes: merged.notes ?? null,
        p_position: merged.position,
      })
    } else {
      const newId = crypto.randomUUID()
      const categorySongs = songs.filter((s) => s.category === modalCategory.key)
      const newSong: PortalSong = {
        id: newId,
        category: modalCategory.key,
        title: data.title ?? '',
        artist: data.artist ?? null,
        notes: data.notes ?? null,
        position: categorySongs.length * 1000,
      }
      setSongs((prev) => [...prev, newSong])
      await supabase.rpc('save_portal_song', {
        p_token: token,
        p_id: newId,
        p_category: modalCategory.key,
        p_title: newSong.title,
        p_artist: newSong.artist,
        p_notes: newSong.notes,
        p_position: newSong.position,
      })
    }

    setSaving(false)
    setModalOpen(false)
    setEditingSong(null)
  }, [editingSong, modalCategory, songs, token])

  const handleDelete = useCallback(async () => {
    if (!editingSong) return
    setSaving(true)
    setSongs((prev) => prev.filter((s) => s.id !== editingSong.id))
    const supabase = anonSupabase()
    await supabase.rpc('delete_portal_song', { p_token: token, p_id: editingSong.id })
    setSaving(false)
    setModalOpen(false)
    setEditingSong(null)
  }, [editingSong, token])

  return (
    <div className="space-y-6 divide-y divide-gray-100">
      {categories.map((cat, i) => (
        <div key={cat.key} className={i > 0 ? 'pt-6' : ''}>
          <CategoryGroup
            category={cat}
            songs={songs}
            onAdd={() => openAdd(cat)}
            onEdit={openEdit}
          />
        </div>
      ))}

      <SongModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSong(null) }}
        onSave={handleSave}
        onDelete={editingSong ? handleDelete : undefined}
        song={editingSong}
        categoryLabel={modalCategory.label}
        saving={saving}
      />
    </div>
  )
}
