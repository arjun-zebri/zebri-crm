'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus, Music } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

import { CoupleTabEmpty, CoupleTabShell } from './couple-tab-shell'
import {
  addPortalSongCategoryAction,
  deletePortalSongCategoryAction,
  updatePortalSongCategoryAction,
} from './portal-actions'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

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
            className="text-body font-semibold uppercase tracking-wider bg-transparent border-b border-gray-400 outline-none text-text w-48"
          />
        ) : (
          <h3 className="text-body font-semibold uppercase tracking-wider text-text">{category.label}</h3>
        )}

        {!renaming && (
          <>
            <button
              onClick={startRename}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-text-muted"
              title="Rename"
            >
              <Pencil size={11} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-text-muted"
              title="Delete category"
            >
              <Trash2 size={11} strokeWidth={1.5} />
            </button>
            <button
              onClick={onAdd}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition cursor-pointer text-text-muted"
              title="Add song"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-body text-text-subtle">Remove category?</span>
            <button onClick={() => onDelete(category.id)} className="text-body text-red-500 hover:text-red-600 transition cursor-pointer">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-body text-text-subtle hover:text-gray-600 transition cursor-pointer">No</button>
          </div>
        )}
      </div>

      {/* Songs */}
      <div className="flex flex-wrap gap-2">
        {songs.length === 0 ? (
          <p className="text-body text-gray-300 py-1">None added</p>
        ) : (
          songs.map((song) => (
            <div
              key={song.id}
              onClick={() => onEditSong(song)}
              className="inline-flex items-center gap-3 border border-border rounded-control px-4 py-2.5 hover:border-border-strong hover:bg-gray-50/50 transition cursor-pointer group/song w-[200px]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-text truncate">{song.title}</p>
                {song.artist && <p className="text-body text-text-subtle truncate">{song.artist}</p>}
              </div>
              <Pencil size={12} strokeWidth={1.5} className="text-text-subtle shrink-0 opacity-0 group-hover/song:opacity-60 transition" />
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

  // Seed defaults on first load. The N parallel inserts route
  // through the action so each one is validated; same outcome as
  // the prior single bulk insert (the table has no unique on
  // (couple_id, key) past the migration's UNIQUE).
  useEffect(() => {
    if (isCategoriesLoading || categories.length > 0) return
    const seed = async () => {
      await Promise.all(
        DEFAULT_CATEGORIES.map((cat, i) =>
          addPortalSongCategoryAction({
            couple_id: coupleId,
            key: cat.key,
            label: cat.label,
            description: null,
            position: i * 1000,
          }),
        ),
      )
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
    }
    seed()
  }, [isCategoriesLoading, categories.length, coupleId, queryClient])

  const renameCategory = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      unwrap(await updatePortalSongCategoryAction(id, label))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] }),
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deletePortalSongCategoryAction(id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] }),
  })

  const addCategory = useMutation({
    mutationFn: async (label: string) => {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      unwrap(
        await addPortalSongCategoryAction({
          couple_id: coupleId,
          key,
          label,
          description: null,
          position: categories.length * 1000,
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
      setNewCategoryLabel('')
      setShowAddCategory(false)
    },
  })

  const isEmpty = !isCategoriesLoading && categories.length === 0

  const actions = (
    <Button
      onClick={() => setShowAddCategory(true)}
      className="cursor-pointer gap-1.5"
    >
      <Plus size={14} strokeWidth={1.5} />
      Add category
    </Button>
  )

  return (
    <CoupleTabShell
      title="Songs"
      stats={songs.length > 0 ? [{ label: `${songs.length} total` }] : undefined}
      actions={actions}
    >
      {isCategoriesLoading ? (
        <div className="space-y-4" aria-hidden="true">
          {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-surface-emphasis rounded-control animate-pulse" />)}
        </div>
      ) : isEmpty ? (
        <CoupleTabEmpty
          icon={Music}
          title="No songs yet"
          description="Create a category with the button above."
        />
      ) : (
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

          {/* Add category inline input */}
          {showAddCategory ? (
            <div className="flex items-center gap-2 mt-2">
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
                className="text-body border-b border-border-strong outline-none bg-transparent text-gray-700 placeholder:text-gray-300 w-48 pb-0.5"
              />
              <button
                onClick={() => { if (newCategoryLabel.trim()) addCategory.mutate(newCategoryLabel.trim()) }}
                disabled={!newCategoryLabel.trim() || addCategory.isPending}
                className="text-body text-text-muted hover:text-gray-700 transition cursor-pointer disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                className="text-body text-text-subtle hover:text-gray-600 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}
    </CoupleTabShell>
  )
}
