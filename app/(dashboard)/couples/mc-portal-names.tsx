'use client'

import { Plus, Pencil } from 'lucide-react'

import { AudioPlayButton } from '@/components/ui/audio-play-button'

interface PortalPerson {
  id: string
  category: string
  full_name: string
  phonetic: string | null
  role: string | null
  audio_url: string | null
  position: number
}

interface McPortalNamesProps {
  people: PortalPerson[]
  isLoading?: boolean
  onEditPerson: (person: PortalPerson, roles: string[]) => void
  onAddPerson: (category: string, roles: string[]) => void
}

const PARTNER_ROLES = ['Bride', 'Groom', 'Partner']
const BRIDAL_ROLES = ['Best Man', 'Maid of Honour', 'Bridesmaid', 'Groomsman', 'Flower Girl', 'Ring Bearer', 'MC', 'Other']
const FAMILY_ROLES = ['Mother of Bride', 'Father of Bride', 'Mother of Groom', 'Father of Groom', 'Grandparent', 'Sibling', 'Other']
const OTHER_ROLES = ['Officiant', 'Celebrant', 'Photographer', 'Videographer', 'Performer', 'Speaker', 'Guest', 'Other']

const LEFT_COLUMNS = [
  { label: 'Couple', category: 'partner', roles: PARTNER_ROLES },
  { label: 'Bridal Party', category: 'bridal_party', roles: BRIDAL_ROLES },
]

const RIGHT_COLUMNS = [
  { label: 'Family', category: 'family', roles: FAMILY_ROLES },
  { label: 'Others', category: 'other', roles: OTHER_ROLES },
]

function CategorySection({
  label, category, roles, people, isLoading, onEditPerson, onAddPerson,
}: {
  label: string
  category: string
  roles: string[]
  people: PortalPerson[]
  isLoading?: boolean
  onEditPerson: (person: PortalPerson, roles: string[]) => void
  onAddPerson: (category: string, roles: string[]) => void
}) {
  const items = people.filter((p) => p.category === category)
  return (
    <div>
      <button
        onClick={() => onAddPerson(category, roles)}
        className="group flex items-center gap-1.5 cursor-pointer"
      >
        <h3 className="text-caption font-semibold uppercase tracking-wider text-text group-hover:text-gray-600 transition">{label}</h3>
        <Plus size={12} strokeWidth={2} className="text-text group-hover:text-gray-600 transition" />
      </button>
      <div className="mt-4 space-y-2.5">
        {isLoading ? (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-surface-emphasis rounded-control animate-pulse" />
            ))}
          </>
        ) : items.length === 0 ? (
          <p className="text-body text-text-subtle py-2">No people added yet.</p>
        ) : (
          items.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 border border-border rounded-control px-5 py-3.5 hover:border-border-strong hover:bg-gray-50/50 transition cursor-pointer group"
              onClick={() => onEditPerson(person, roles)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-text">{person.full_name || 'Unnamed'}</p>
                {person.phonetic && (
                  <p className="text-body text-text-muted mt-0.5 font-mono">{person.phonetic}</p>
                )}
              </div>
              {person.audio_url && (
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <AudioPlayButton
                    src={person.audio_url}
                    label="Listen"
                    className="flex items-center gap-1 text-caption border rounded-control px-2.5 py-1.5 transition cursor-pointer"
                    idleClassName="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    playingClassName="text-emerald-700 border-emerald-300 bg-emerald-100 hover:bg-emerald-200"
                  />
                </div>
              )}
              <Pencil size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function McPortalNames({ people, isLoading, onEditPerson, onAddPerson }: McPortalNamesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
      {/* Left: Couple + Bridal Party */}
      <div className="space-y-8">
        {LEFT_COLUMNS.map(({ label, category, roles }) => (
          <CategorySection
            key={category}
            label={label}
            category={category}
            roles={roles}
            people={people}
            isLoading={isLoading}
            onEditPerson={onEditPerson}
            onAddPerson={onAddPerson}
          />
        ))}
      </div>

      {/* Right: Family + Others */}
      <div className="space-y-8">
        {RIGHT_COLUMNS.map(({ label, category, roles }) => (
          <CategorySection
            key={category}
            label={label}
            category={category}
            roles={roles}
            people={people}
            isLoading={isLoading}
            onEditPerson={onEditPerson}
            onAddPerson={onAddPerson}
          />
        ))}
      </div>
    </div>
  )
}
