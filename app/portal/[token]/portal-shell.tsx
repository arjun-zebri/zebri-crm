'use client'

import { LayoutDashboard, Users2, Clock, Music, FileText, FileSignature, Receipt, Heart } from 'lucide-react'
import { useState } from 'react'

import { PortalSectionNav } from '@/app/(dashboard)/couples/portal-section-nav'

import { ContactsSection } from './contacts-section'
import { ContractsSection } from './contracts-section'
import { FilesSection } from './files-section'
import { OverviewSection } from './overview-section'
import type { PortalData } from './page'
import { PaymentsSection } from './payments-section'
import { SongsSection } from './songs-section'
import { TimelineSection } from './timeline-section'
import { VowsSection } from './vows-section'

const ALL_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard />, subtitle: 'Your details and upcoming events' },
  { id: 'timeline', label: 'Timeline', icon: <Clock />, subtitle: 'Key moments and timing for your day' },
  { id: 'contacts', label: 'Contacts', icon: <Users2 />, subtitle: 'Your wedding party and vendor contacts' },
  { id: 'payments', label: 'Payments', icon: <Receipt />, subtitle: 'Quotes and invoices' },
  { id: 'contracts', label: 'Contracts', icon: <FileSignature />, subtitle: 'Review and sign your agreements' },
  { id: 'songs', label: 'Songs', icon: <Music />, subtitle: 'Music for each part of your ceremony and reception' },
  { id: 'files', label: 'Files', icon: <FileText />, subtitle: 'Contracts, seating charts, photos. Anything your MC needs.' },
  { id: 'vows', label: 'Vows', icon: <Heart />, subtitle: 'Write your vows for the ceremony' },
]

interface PortalShellProps {
  token: string
  initialData: PortalData
}

export function PortalShell({ token, initialData }: PortalShellProps) {
  const enabledSections = initialData.enabled_sections
  const SECTIONS = enabledSections === null || enabledSections === undefined
    ? ALL_SECTIONS
    : ALL_SECTIONS.filter(s => s.id === 'overview' || enabledSections.includes(s.id))

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
            : s.id === 'vows' ? initialData.vows.length
            : undefined,
        }))}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text">{active.label}</h2>
          <p className="text-sm text-text-muted mt-0.5">{active.subtitle}</p>
        </div>

        {activeSection === 'overview' && (
          <OverviewSection
            token={token}
            primary={{
              name: initialData.primary_name ?? '',
              email: initialData.primary_email ?? '',
              phone: initialData.primary_phone ?? '',
            }}
            secondary={{
              name: initialData.secondary_name ?? '',
              email: initialData.secondary_email ?? '',
              phone: initialData.secondary_phone ?? '',
            }}
            events={initialData.events}
          />
        )}
        {activeSection === 'timeline' && (
          <TimelineSection
            token={token}
            initialItems={initialData.timeline_items}
            events={initialData.events}
            hasEvent={!!initialData.event}
          />
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
        {activeSection === 'vows' && (
          <VowsSection
            token={token}
            initialVows={initialData.vows}
            viewer={initialData.viewer}
            primaryName={initialData.primary_name}
            secondaryName={initialData.secondary_name}
          />
        )}
      </div>
    </div>
  )
}
