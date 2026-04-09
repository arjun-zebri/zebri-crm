'use client'

import { Plus, Pencil } from 'lucide-react'

interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

interface McPortalSongsProps {
  songs: PortalSong[]
  categories: { key: string; label: string; description?: string | null }[]
  onEditSong: (song: PortalSong) => void
  onAddSong: (key: string, label: string) => void
}

export function McPortalSongs({ songs, categories, onEditSong, onAddSong }: McPortalSongsProps) {
  const grouped = categories.reduce<Record<string, PortalSong[]>>((acc, { key }) => {
    acc[key] = songs.filter((s) => s.category === key)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {categories.map(({ key, label }) => {
        const categorySongs = grouped[key] || []
        return (
          <div key={key} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <button
                onClick={() => onAddSong(key, label)}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition cursor-pointer"
              >
                <Plus size={14} strokeWidth={1.5} />
                Add
              </button>
            </div>
            {categorySongs.length === 0 ? (
              <p className="text-sm text-gray-300 py-2">None added</p>
            ) : (
              categorySongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-3.5 hover:border-gray-300 hover:bg-gray-50/50 transition cursor-pointer group"
                  onClick={() => onEditSong(song)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-gray-900">{song.title}</p>
                    {(song.artist || song.notes) && (
                      <p className="text-sm text-gray-500 mt-0.5">{[song.artist, song.notes].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <Pencil size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
