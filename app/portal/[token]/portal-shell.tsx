'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { NamesSection } from './names-section'
import { RunSheetSection } from './run-sheet-section'
import { SongsSection } from './songs-section'
import { FilesSection } from './files-section'
import type { PortalData } from './page'

interface SectionCardProps {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function SectionCard({ title, subtitle, open, onToggle, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition cursor-pointer"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {open
          ? <ChevronUp size={16} strokeWidth={1.5} className="text-gray-400 shrink-0" />
          : <ChevronDown size={16} strokeWidth={1.5} className="text-gray-400 shrink-0" />
        }
      </button>
      {open && (
        <div className="border-t border-gray-100 px-6 py-5">
          {children}
        </div>
      )}
    </div>
  )
}

interface PortalShellProps {
  token: string
  initialData: PortalData
}

export function PortalShell({ token, initialData }: PortalShellProps) {
  const [openSection, setOpenSection] = useState<string | null>('names')

  const toggle = (section: string) =>
    setOpenSection((prev) => (prev === section ? null : section))

  return (
    <div className="pt-6 space-y-3">
      <SectionCard
        title="Names & Pronunciations"
        subtitle="Help your MC say every name perfectly"
        open={openSection === 'names'}
        onToggle={() => toggle('names')}
      >
        <NamesSection token={token} initialPeople={initialData.people} />
      </SectionCard>

      <SectionCard
        title="Run Sheet"
        subtitle="Key moments and timing for your day"
        open={openSection === 'runsheet'}
        onToggle={() => toggle('runsheet')}
      >
        <RunSheetSection
          token={token}
          initialItems={initialData.timeline_items}
          hasEvent={!!initialData.event}
        />
      </SectionCard>

      <SectionCard
        title="Song Requests"
        subtitle="Music for each part of your ceremony and reception"
        open={openSection === 'songs'}
        onToggle={() => toggle('songs')}
      >
        <SongsSection token={token} initialSongs={initialData.songs} />
      </SectionCard>

      <SectionCard
        title="Files & Documents"
        subtitle="Contracts, seating charts, photos — anything your MC needs"
        open={openSection === 'files'}
        onToggle={() => toggle('files')}
      >
        <FilesSection token={token} initialFiles={initialData.files} />
      </SectionCard>
    </div>
  )
}
