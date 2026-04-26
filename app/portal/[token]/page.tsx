import Image from 'next/image'
import { createServerClient } from '@supabase/ssr'
import { PortalShell } from './portal-shell'

export interface PortalPerson {
  id: string
  category: 'partner' | 'bridal_party' | 'family'
  full_name: string
  phonetic: string | null
  role: string | null
  audio_url: string | null
  position: number
}

export interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

export interface PortalFile {
  id: string
  name: string
  file_url: string
  file_size: number | null
  created_at: string
}

export interface PortalTimelineItem {
  id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}

export interface PortalEvent {
  id: string
  date: string
  venue: string | null
  status: string
}

export interface PortalContact {
  id: string
  name: string
  category: string | null
  email: string | null
  phone: string | null
}

export interface PortalQuote {
  id: string
  title: string
  quote_number: string
  status: string
  subtotal: number
  share_token: string | null
  share_token_enabled: boolean
}

export interface PortalInvoice {
  id: string
  title: string
  invoice_number: string
  status: string
  subtotal: number
  due_date: string | null
  share_token: string | null
  share_token_enabled: boolean
}

export interface PortalContract {
  id: string
  title: string
  contract_number: string
  status: string
  share_token: string | null
  share_token_enabled: boolean
  email_sent_at: string | null
  signed_at: string | null
}

export interface PortalSongCategory {
  key: string
  label: string
  description: string | null
  position: number
}

export interface PortalData {
  couple_id: string
  couple_name: string
  couple_email: string | null
  event: { id: string; date: string; venue: string } | null
  events: PortalEvent[]
  people: PortalPerson[]
  contacts: PortalContact[]
  songs: PortalSong[]
  song_categories: PortalSongCategory[]
  files: PortalFile[]
  timeline_items: PortalTimelineItem[]
  payments: {
    quotes: PortalQuote[]
    invoices: PortalInvoice[]
  }
  contracts: PortalContract[]
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data } = await supabase.rpc('get_portal_data', { token })
  const portal = data as PortalData | null

  if (!portal) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 gap-6">
        <Image src="/zebri-logo.svg" alt="Zebri" width={80} height={29} />
        <p className="text-sm text-gray-500">This link is not active.</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          Contact your MC to activate your portal link.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 pb-20">

        {/* Logo */}
        <div className="pt-10 pb-2">
          <Image src="/zebri-logo.svg" alt="Zebri" width={64} height={23} />
        </div>

        {/* Hero */}
        <div className="pt-8 pb-8 border-b border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">
            {portal.couple_name}
          </h1>
          {portal.event && (
            <p className="text-sm text-gray-500">
              {formatEventDate(portal.event.date)}
              {portal.event.venue ? ` · ${portal.event.venue.replace(/\s*[—–]\s*/g, ', ')}` : ''}
            </p>
          )}
          <p className="mt-3 text-sm text-gray-500">
            Fill in your details below. Everything saves automatically. You can come back anytime.
          </p>
        </div>

        {/* Portal sections */}
        <PortalShell
          token={token}
          initialData={portal}
        />

      </div>
    </div>
  )
}
