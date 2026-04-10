'use client'

import { Play, Plus, Pencil } from 'lucide-react'

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
  label, category, roles, people, onEditPerson, onAddPerson,
}: {
  label: string
  category: string
  roles: string[]
  people: PortalPerson[]
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 group-hover:text-gray-600 transition">{label}</h3>
        <Plus size={12} strokeWidth={2} className="text-gray-900 group-hover:text-gray-600 transition" />
      </button>
      <div className="mt-4 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-sm text-gray-300 py-2">None added</p>
        ) : (
          items.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-3.5 hover:border-gray-300 hover:bg-gray-50/50 transition cursor-pointer group"
              onClick={() => onEditPerson(person, roles)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900">{person.full_name || 'Unnamed'}</p>
                {person.phonetic && (
                  <p className="text-sm text-gray-500 mt-0.5 font-mono">{person.phonetic}</p>
                )}
              </div>
              {person.audio_url && (
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <audio src={person.audio_url} id={`mc-audio-${person.id}`} className="hidden" />
                  <button
                    onClick={() => (document.getElementById(`mc-audio-${person.id}`) as HTMLAudioElement)?.play()}
                    className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <Play size={12} strokeWidth={2} />
                    Listen
                  </button>
                </div>
              )}
              <Pencil size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function McPortalNames({ people, onEditPerson, onAddPerson }: McPortalNamesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
      {/* Left: Couple + Bridal Party */}
      <div className="space-y-8">
        {LEFT_COLUMNS.map(({ label, category, roles }) => (
          <CategorySection
            key={category}
            label={label}
            category={category}
            roles={roles}
            people={people}
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
            onEditPerson={onEditPerson}
            onAddPerson={onAddPerson}
          />
        ))}
      </div>
    </div>
  )
}
