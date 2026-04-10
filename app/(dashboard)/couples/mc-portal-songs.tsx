'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

interface SongCategory {
  id: string
  key: string
  label: string
  position: number
}

const DEFAULT_CATEGORIES = [
  { key: 'parents_entry', label: 'Parents Entry' },
  { key: 'bridal_party_entry', label: 'Bridal Party Entry' },
  { key: 'couple_entry', label: 'Couple Entry' },
]

interface McPortalSongsProps {
  coupleId: string
  onEditSong: (song: PortalSong) => void
  onAddSong: (key: string, label: string) => void
}

// ── Category heading with inline rename ──────────────────────────────────────

function CategorySection({
  category,
  songs,
  onRename,
  onDelete,
  onAdd,
  onEditSong,
}: {
  category: SongCategory
  songs: PortalSong[]
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onEditSong: (song: PortalSong) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(category.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleRenameCommit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== category.label) {
      onRename(category.id, trimmed)
    } else {
      setRenameValue(category.label)
    }
    setRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') { setRenameValue(category.label); setRenaming(false) }
  }

  const startRename = () => {
    setRenameValue(category.label)
    setRenaming(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div>
      {/* Heading row */}
      <div className="group flex items-center gap-2 mb-3">
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={handleRenameKeyDown}
            className="text-xs font-semibold uppercase tracking-wider bg-transparent border-b border-gray-400 outline-none text-gray-900 w-48"
          />
        ) : (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">{category.label}</h3>
        )}

        {!renaming && (
          <>
            <button
              onClick={startRename}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-gray-500"
              title="Rename"
            >
              <Pencil size={11} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-gray-500"
              title="Delete category"
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
            <button
              onClick={onAdd}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-gray-500"
              title="Add song"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-gray-400">Remove category?</span>
            <button onClick={() => onDelete(category.id)} className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">No</button>
          </div>
        )}
      </div>

      {/* Songs */}
      <div className="flex flex-wrap gap-2">
        {songs.length === 0 ? (
          <p className="text-sm text-gray-300 py-1">None added</p>
        ) : (
          songs.map((song) => (
            <div
              key={song.id}
              onClick={() => onEditSong(song)}
              className="inline-flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 hover:bg-gray-50/50 transition cursor-pointer group/song w-[200px]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                {song.artist && <p className="text-xs text-gray-400 truncate">{song.artist}</p>}
              </div>
              <Pencil size={12} strokeWidth={1.5} className="text-gray-400 shrink-0 opacity-0 group-hover/song:opacity-60 transition" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function McPortalSongs({ coupleId, onEditSong, onAddSong }: McPortalSongsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<SongCategory[]>({
    queryKey: ['portal-song-categories', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_song_categories')
        .select('id, key, label, position')
        .eq('couple_id', coupleId)
        .order('position')
      if (error) throw error
      return data || []
    },
  })

  const { data: songs = [] } = useQuery<PortalSong[]>({
    queryKey: ['portal-songs', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_songs')
        .select('*')
        .eq('couple_id', coupleId)
        .order('category')
        .order('position')
      if (error) throw error
      return data || []
    },
  })

  // Seed defaults on first load
  useEffect(() => {
    if (isCategoriesLoading || categories.length > 0) return
    const seed = async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return
      await supabase.from('portal_song_categories').insert(
        DEFAULT_CATEGORIES.map((cat, i) => ({
          couple_id: coupleId,
          user_id: user.user!.id,
          key: cat.key,
          label: cat.label,
          description: null,
          position: i * 1000,
        }))
      )
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
    }
    seed()
  }, [isCategoriesLoading, categories.length, coupleId, supabase, queryClient])

  const renameCategory = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from('portal_song_categories').update({ label }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] }),
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portal_song_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] }),
  })

  const addCategory = useMutation({
    mutationFn: async (label: string) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const { error } = await supabase.from('portal_song_categories').insert({
        couple_id: coupleId,
        user_id: user.user.id,
        key,
        label,
        description: null,
        position: categories.length * 1000,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
      setNewCategoryLabel('')
      setShowAddCategory(false)
    },
  })

  if (isCategoriesLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {categories.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat}
          songs={songs.filter((s) => s.category === cat.key)}
          onRename={(id, label) => renameCategory.mutate({ id, label })}
          onDelete={(id) => deleteCategory.mutate(id)}
          onAdd={() => onAddSong(cat.key, cat.label)}
          onEditSong={onEditSong}
        />
      ))}

      {/* Add category */}
      <div className="mt-2">
        {showAddCategory ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryLabel.trim()) addCategory.mutate(newCategoryLabel.trim())
                if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryLabel('') }
              }}
              placeholder="Category name"
              autoFocus
              className="text-sm border-b border-gray-300 outline-none bg-transparent text-gray-700 placeholder:text-gray-300 w-48 pb-0.5"
            />
            <button
              onClick={() => { if (newCategoryLabel.trim()) addCategory.mutate(newCategoryLabel.trim()) }}
              disabled={!newCategoryLabel.trim() || addCategory.isPending}
              className="text-xs text-gray-500 hover:text-gray-700 transition cursor-pointer disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
              className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <Plus size={13} strokeWidth={1.5} />
            Add category
          </button>
        )}
      </div>
    </div>
  )
}
