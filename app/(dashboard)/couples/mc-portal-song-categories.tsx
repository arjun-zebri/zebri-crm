'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Trash2, GripVertical, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface SongCategory {
  id: string
  couple_id: string
  user_id: string
  key: string
  label: string
  description: string | null
  position: number
}

interface PortalSong {
  id: string
  category: string
  title: string
}

const DEFAULT_CATEGORIES = [
  { key: 'entry_partner1', label: 'Partner 1 Entry', description: 'Song playing as Partner 1 enters' },
  { key: 'entry_partner2', label: 'Partner 2 Entry', description: 'Song playing as Partner 2 enters' },
  { key: 'first_dance', label: 'First Dance', description: 'Your first dance as a married couple' },
  { key: 'bridal_party_entry', label: 'Bridal Party Entry', description: 'Song for bridal party walk-in' },
  { key: 'ceremony', label: 'Ceremony', description: 'Other ceremony music' },
  { key: 'reception', label: 'Reception', description: 'Reception and dancing music' },
  { key: 'avoid', label: 'Do Not Play', description: "Songs you definitely don't want played" },
]

interface McPortalSongCategoriesProps {
  coupleId: string
  userId: string
}

export function McPortalSongCategories({ coupleId, userId }: McPortalSongCategoriesProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [newLabel, setNewLabel] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingCategoryKey, setDeletingCategoryKey] = useState<string | null>(null)

  // Query categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<SongCategory[]>({
    queryKey: ['portal-song-categories', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_song_categories')
        .select('*')
        .eq('couple_id', coupleId)
        .order('position')
      if (error) throw error
      return data || []
    },
  })

  // Query songs to check for category usage
  const { data: songs = [] } = useQuery<PortalSong[]>({
    queryKey: ['portal-songs', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_songs')
        .select('id, category, title')
        .eq('couple_id', coupleId)
      if (error) throw error
      return data || []
    },
  })

  // Seed defaults if no categories exist
  useEffect(() => {
    const seedDefaults = async () => {
      if (categories.length === 0 && !isCategoriesLoading) {
        try {
          const { data: user } = await supabase.auth.getUser()
          if (!user.user) return

          const defaultsToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
            couple_id: coupleId,
            user_id: user.user.id,
            key: cat.key,
            label: cat.label,
            description: cat.description,
            position: index * 1000,
          }))

          await supabase
            .from('portal_song_categories')
            .insert(defaultsToInsert)

          queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
        } catch (err) {
          console.error('Failed to seed default categories:', err)
        }
      }
    }

    seedDefaults()
  }, [categories.length, isCategoriesLoading, coupleId, supabase, queryClient])

  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async (label: string) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      // Generate slug from label
      const key = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')

      const { error } = await supabase
        .from('portal_song_categories')
        .insert({
          couple_id: coupleId,
          user_id: user.user.id,
          key,
          label,
          description: null,
          position: (categories.length || 0) * 1000,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
      setNewLabel('')
      setShowAddForm(false)
      toast('Category added')
    },
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryKey: string) => {
      const { error } = await supabase
        .from('portal_song_categories')
        .delete()
        .eq('couple_id', coupleId)
        .eq('key', categoryKey)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-song-categories', coupleId] })
      setDeletingCategoryKey(null)
      toast('Category removed')
    },
  })

  const getCategoryUsageCount = (categoryKey: string) => {
    return songs.filter((s) => s.category === categoryKey).length
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        <p>Customize the song categories for this couple. These will appear in their portal.</p>
      </div>

      {isCategoriesLoading ? (
        <p className="text-sm text-gray-400">Loading categories...</p>
      ) : (
        <>
          <div className="space-y-2">
            {categories.map((cat) => {
              const usageCount = getCategoryUsageCount(cat.key)
              const isBeingDeleted = deletingCategoryKey === cat.key

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5"
                >
                  <GripVertical size={16} className="text-gray-300 shrink-0 cursor-move" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                    {cat.description && (
                      <p className="text-xs text-gray-500">{cat.description}</p>
                    )}
                  </div>
                  {usageCount > 0 && (
                    <span className="text-xs text-gray-400 shrink-0">{usageCount} song{usageCount !== 1 ? 's' : ''}</span>
                  )}
                  <button
                    onClick={() => setDeletingCategoryKey(isBeingDeleted ? null : cat.key)}
                    disabled={usageCount > 0 && !isBeingDeleted}
                    className={`p-1 rounded transition ${
                      usageCount > 0 && !isBeingDeleted
                        ? 'text-gray-300 cursor-not-allowed'
                        : isBeingDeleted
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'text-gray-400 hover:text-red-500'
                    }`}
                    title={usageCount > 0 && !isBeingDeleted ? 'Cannot delete category with songs' : ''}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                  {isBeingDeleted && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => deleteCategoryMutation.mutate(cat.key)}
                        disabled={deleteCategoryMutation.isPending}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                      >
                        {deleteCategoryMutation.isPending ? 'Deleting...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setDeletingCategoryKey(null)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition w-full justify-center"
            >
              <Plus size={14} strokeWidth={1.5} />
              Add category
            </button>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Category name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewLabel('')
                  }}
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addCategoryMutation.mutate(newLabel)}
                  disabled={!newLabel.trim() || addCategoryMutation.isPending}
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {addCategoryMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
