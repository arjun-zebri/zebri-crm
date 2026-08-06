'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Plus, Trash2, Music, Pencil, ChevronDown } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

import { Modal } from '@/components/ui/modal'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

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

interface SongModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => Promise<void>
  onDelete?: () => Promise<void>
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
  branding: PublicBranding
}

function SongModal({ isOpen, onClose, onSave, onDelete, song, categoryLabel, saving, branding }: SongModalProps) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [notes, setNotes] = useState(song?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  const bodyDefaults = roleDefaults(branding, 'body')

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
            <label
              className="block mb-1"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Song title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Can't Help Falling in Love"
              style={{
                width: '100%',
                border: `1px solid ${branding.border_color}`,
                borderRadius: `${branding.corner_radius}px`,
                padding: '0.5rem 0.75rem',
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
                outline: 'none',
              }}
              className="transition"
              autoFocus
            />
          </div>
          <div>
            <label
              className="block mb-1"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Artist (optional)
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Elvis Presley"
              style={{
                width: '100%',
                border: `1px solid ${branding.border_color}`,
                borderRadius: `${branding.corner_radius}px`,
                padding: '0.5rem 0.75rem',
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
                outline: 'none',
              }}
              className="transition"
            />
          </div>
          <div>
            <label
              className="block mb-1"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Start from the chorus"
              style={{
                width: '100%',
                border: `1px solid ${branding.border_color}`,
                borderRadius: `${branding.corner_radius}px`,
                padding: '0.5rem 0.75rem',
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
                outline: 'none',
              }}
              className="transition"
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: `1px solid ${branding.border_color}` }}
        >
          {song && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: finePrintDefaults.color,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Remove this song?
                </span>
                <button
                  type="button"
                  onClick={async () => { await onDelete(); setConfirmDelete(false) }}
                  className="transition cursor-pointer hover:opacity-80"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: STATUS_COLORS.error,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="transition cursor-pointer hover:opacity-80"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: finePrintDefaults.color,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 transition cursor-pointer hover:opacity-80"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
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
              className="px-3 py-1.5 transition cursor-pointer hover:opacity-75"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
                border: `1px solid ${branding.border_color}`,
                borderRadius: `${branding.corner_radius}px`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="rounded-control px-3 py-1.5 transition cursor-pointer disabled:opacity-50 hover:opacity-90"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: 'white',
                backgroundColor: branding.brand_color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
                borderRadius: `${branding.corner_radius}px`,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
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
  branding: PublicBranding
}

function CategoryGroup({ category, songs, onAdd, onEdit, branding }: CategoryGroupProps) {
  const categorySongs = songs.filter((s) => s.category === category.key)
  const [expanded, setExpanded] = useState(categorySongs.length > 0)
  const isAvoidCategory = category.key === 'avoid'
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  return (
    <div className="space-y-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-0 transition cursor-pointer hover:opacity-80"
      >
        <div className="flex-1 text-left">
          <p
            className="font-medium"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: 500,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            {category.label}
          </p>
          {category.description && (
            <p
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
                opacity: 0.7,
              }}
            >
              {category.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            {categorySongs.length}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            style={{ color: finePrintDefaults.color, transform: expanded ? '' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
          />
        </div>
      </button>

      {expanded && (
        <>
          {categorySongs.length === 0 ? (
            <div
              className="border border-dashed rounded-control py-3.5 flex items-center justify-center gap-1.5"
              style={{
                borderColor: isAvoidCategory ? STATUS_COLORS.error : branding.border_color,
                backgroundColor: isAvoidCategory ? `${STATUS_COLORS.error}10` : branding.surface_color,
              }}
            >
              <Music
                size={14}
                strokeWidth={1.5}
                style={{ color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color, opacity: 0.5 }}
              />
              <span
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                  opacity: 0.7,
                }}
              >
                No songs yet
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {categorySongs.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-control px-5 py-3.5 transition cursor-pointer hover:opacity-90"
                  style={{
                    border: `1px solid ${isAvoidCategory ? STATUS_COLORS.error : branding.border_color}30`,
                    backgroundColor: isAvoidCategory ? `${STATUS_COLORS.error}10` : branding.surface_color,
                  }}
                  onClick={() => onEdit(s)}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: isAvoidCategory ? STATUS_COLORS.error : bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: 500,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {s.title}
                    </p>
                    <p
                      style={{
                        fontSize: `${finePrintDefaults.fontSize}px`,
                        color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
                        fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                        fontWeight: finePrintDefaults.fontWeight,
                        lineHeight: finePrintDefaults.lineHeight,
                        opacity: 0.75,
                      }}
                    >
                      {[s.artist, s.notes].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                  <Pencil
                    size={13}
                    strokeWidth={1.5}
                    style={{ color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color, opacity: 0.5 }}
                  />
                </div>
              ))}
            </div>
          )}
          {categorySongs.length >= 0 && (
            <button
              onClick={onAdd}
              className="w-full font-medium rounded-control px-3 py-2 transition cursor-pointer border border-dashed hover:opacity-80"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: isAvoidCategory ? STATUS_COLORS.error : finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: 500,
                lineHeight: finePrintDefaults.lineHeight,
                borderColor: isAvoidCategory ? STATUS_COLORS.error : branding.border_color,
                backgroundColor: isAvoidCategory ? `${STATUS_COLORS.error}10` : branding.surface_color,
                borderRadius: `${branding.corner_radius}px`,
              }}
            >
              <Plus size={13} strokeWidth={1.5} className="inline mr-1" />
              Add song
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface SongsSectionProps {
  token: string
  initialSongs: PortalSong[]
  initialCategories: PortalSongCategory[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

export function SongsSection({ token, initialSongs, initialCategories, branding }: SongsSectionProps) {
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
    <div style={{ borderColor: branding.border_color }} className="space-y-4 divide-y">
      {categories.map((cat, i) => (
        <div key={cat.key} style={{ paddingTop: i > 0 ? '1rem' : undefined }}>
          <CategoryGroup
            category={cat}
            songs={songs}
            onAdd={() => openAdd(cat)}
            onEdit={openEdit}
            branding={branding}
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
        branding={branding}
      />
    </div>
  )
}
