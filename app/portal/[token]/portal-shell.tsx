'use client'

import { LayoutDashboard, Users2, Clock, Music, FileText, FileSignature, Receipt, Heart, ClipboardList } from 'lucide-react'
import { useState } from 'react'

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TextStyle } from '@/app/(dashboard)/branding/blocks/types'
import { PortalSectionNav } from '@/app/(dashboard)/couples/portal-section-nav'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { ContactsSection } from './contacts-section'
import { ContractsSection } from './contracts-section'
import { FilesSection } from './files-section'
import { OverviewSection } from './overview-section'
import type { PortalData } from './page'
import { PaymentsSection } from './payments-section'
import { QuestionnairesSection } from './questionnaires-section'
import { SongsSection } from './songs-section'
import { TimelineSection } from './timeline-section'
import { VowsSection } from './vows-section'

const ALL_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard />, subtitle: 'Your details and upcoming events' },
  { id: 'timeline', label: 'Timeline', icon: <Clock />, subtitle: 'Key moments and timing for your day' },
  { id: 'contacts', label: 'Contacts', icon: <Users2 />, subtitle: 'Your wedding party and vendor contacts' },
  { id: 'payments', label: 'Payments', icon: <Receipt />, subtitle: 'Quotes and invoices' },
  { id: 'contracts', label: 'Contracts', icon: <FileSignature />, subtitle: 'Review and sign your agreements' },
  { id: 'questionnaires', label: 'Questionnaires', icon: <ClipboardList />, subtitle: 'A few questions to help plan your day' },
  { id: 'songs', label: 'Songs', icon: <Music />, subtitle: 'Music for each part of your ceremony and reception' },
  { id: 'files', label: 'Files', icon: <FileText />, subtitle: 'Contracts, seating charts, photos. Anything your MC needs.' },
  { id: 'vows', label: 'Vows', icon: <Heart />, subtitle: 'Write your vows for the ceremony' },
]

interface PortalShellProps {
  token: string
  initialData: PortalData
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
  /**
   * Portal-scoped typography overrides from the `couplePortal` branding block.
   * `heading` styles each section's `<h2>`, `body` its subtitle `<p>`. Each unset
   * field falls back to the value the shell currently hard-codes, so a portal
   * with no overrides renders byte-identically.
   */
  styles?: {
    heading?: TextStyle | undefined
    body?: TextStyle | undefined
  }
}

export function PortalShell({ token, initialData, branding, styles }: PortalShellProps) {
  // Type scale from branding.
  const sectionHeadingDefaults = roleDefaults(branding, 'sectionHeading')
  const bodyDefaults = roleDefaults(branding, 'body')
  // Portal-scoped overrides resolved over defaults built from the SAME values
  // the shell hard-codes today (the role's font / size / weight / colour /
  // line-height) with `letterSpacing: 0` + `textTransform: 'none'` forced — the
  // neutral values the current inline styles already render (they set neither).
  // So with no override each `resolveTextStyle` yields today's style exactly.
  const headingCss = resolveTextStyle(styles?.heading, {
    ...sectionHeadingDefaults,
    letterSpacing: 0,
    textTransform: 'none',
  })
  const bodyCss = resolveTextStyle(styles?.body, {
    ...bodyDefaults,
    letterSpacing: 0,
    textTransform: 'none',
  })

  const enabledSections = initialData.enabled_sections
  // Questionnaires is a newer section, so it won't appear in an MC's saved
  // enabled-sections list yet. Surface it whenever the couple actually has one
  // so a sent questionnaire is never hidden.
  const hasQuestionnaires = (initialData.questionnaires?.length ?? 0) > 0
  const SECTIONS = enabledSections === null || enabledSections === undefined
    ? ALL_SECTIONS
    : ALL_SECTIONS.filter(
        (s) =>
          s.id === 'overview' ||
          enabledSections.includes(s.id) ||
          (s.id === 'questionnaires' && hasQuestionnaires),
      )

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
            : s.id === 'payments' ? initialData.payments.invoices.length
            : s.id === 'contracts' ? (initialData.contracts?.length ?? 0)
            : s.id === 'questionnaires' ? (initialData.questionnaires?.length ?? 0)
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
          <h2 className="font-semibold" style={headingCss}>
            {active.label}
          </h2>
          <p className="mt-0.5" style={bodyCss}>
            {active.subtitle}
          </p>
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
            packages={initialData.packages}
            branding={branding}
          />
        )}
        {activeSection === 'timeline' && (
          <TimelineSection
            token={token}
            initialItems={initialData.timeline_items}
            events={initialData.events}
            hasEvent={!!initialData.event}
            branding={branding}
          />
        )}
        {activeSection === 'contacts' && (
          <ContactsSection token={token} initialContacts={initialData.contacts} initialPeople={initialData.people} branding={branding} />
        )}
        {activeSection === 'payments' && (
          <PaymentsSection payments={initialData.payments} branding={branding} />
        )}
        {activeSection === 'contracts' && (
          <ContractsSection contracts={initialData.contracts ?? []} branding={branding} />
        )}
        {activeSection === 'questionnaires' && (
          <QuestionnairesSection questionnaires={initialData.questionnaires ?? []} branding={branding} />
        )}
        {activeSection === 'songs' && (
          <SongsSection token={token} initialSongs={initialData.songs} initialCategories={initialData.song_categories} branding={branding} />
        )}
        {activeSection === 'files' && (
          <FilesSection token={token} initialFiles={initialData.files} branding={branding} />
        )}
        {activeSection === 'vows' && (
          <VowsSection
            token={token}
            initialVows={initialData.vows}
            viewer={initialData.viewer}
            primaryName={initialData.primary_name}
            secondaryName={initialData.secondary_name}
            branding={branding}
          />
        )}
      </div>
    </div>
  )
}
