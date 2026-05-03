'use client'

import { useState } from 'react'
import { LayoutDashboard, Users2, Clock, Music, FileText, FileSignature, Receipt } from 'lucide-react'
import { PortalSectionNav } from '@/app/(dashboard)/couples/portal-section-nav'
import { OverviewSection } from './overview-section'
import { TimelineSection } from './timeline-section'
import { ContactsSection } from './contacts-section'
import { ContractsSection } from './contracts-section'
import { SongsSection } from './songs-section'
import { PaymentsSection } from './payments-section'
import { FilesSection } from './files-section'
import type { PortalData } from './page'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard />, subtitle: 'Your details and upcoming events' },
  { id: 'timeline', label: 'Timeline', icon: <Clock />, subtitle: 'Key moments and timing for your day' },
  { id: 'contacts', label: 'Contacts', icon: <Users2 />, subtitle: 'Your wedding party and vendor contacts' },
  { id: 'payments', label: 'Payments', icon: <Receipt />, subtitle: 'Quotes and invoices' },
  { id: 'contracts', label: 'Contracts', icon: <FileSignature />, subtitle: 'Review and sign your agreements' },
  { id: 'songs', label: 'Songs', icon: <Music />, subtitle: 'Music for each part of your ceremony and reception' },
  { id: 'files', label: 'Files', icon: <FileText />, subtitle: 'Contracts, seating charts, photos. Anything your MC needs.' },
]

interface PortalShellProps {
  token: string
  initialData: PortalData
}

export function PortalShell({ token, initialData }: PortalShellProps) {
  const [activeSection, setActiveSection] = useState('overview')
  const active = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0]

  return (
    <div className="flex flex-col md:flex-row gap-6 pt-6">
      <PortalSectionNav
        sections={SECTIONS.map((s) => ({
          id: s.id,
          label: s.label,
          icon: s.icon,
          count: s.id === 'overview' ? initialData.events.length
            : s.id === 'timeline' ? initialData.timeline_items.length
            : s.id === 'contacts' ? initialData.contacts.length + initialData.people.length
            : s.id === 'payments' ? (initialData.payments.quotes.length + initialData.payments.invoices.length)
            : s.id === 'contracts' ? (initialData.contracts?.length ?? 0)
            : s.id === 'songs' ? initialData.songs.length
            : s.id === 'files' ? initialData.files.length
            : undefined,
        }))}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{active.label}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{active.subtitle}</p>
        </div>

        {activeSection === 'overview' && (
          <OverviewSection coupleName={initialData.couple_name} coupleEmail={initialData.couple_email} events={initialData.events} />
        )}
        {activeSection === 'timeline' && (
          <TimelineSection token={token} initialItems={initialData.timeline_items} hasEvent={!!initialData.event} />
        )}
        {activeSection === 'contacts' && (
          <ContactsSection token={token} initialContacts={initialData.contacts} initialPeople={initialData.people} />
        )}
        {activeSection === 'payments' && (
          <PaymentsSection payments={initialData.payments} />
        )}
        {activeSection === 'contracts' && (
          <ContractsSection contracts={initialData.contracts ?? []} />
        )}
        {activeSection === 'songs' && (
          <SongsSection token={token} initialSongs={initialData.songs} initialCategories={initialData.song_categories} />
        )}
        {activeSection === 'files' && (
          <FilesSection token={token} initialFiles={initialData.files} />
        )}
      </div>
    </div>
  )
}
