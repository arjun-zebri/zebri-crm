'use client'

import { ExternalLink } from 'lucide-react'
import { PortalContract } from './page'

interface ContractsSectionProps {
  contracts: PortalContract[]
}

function statusColor(status: string): string {
  switch (status) {
    case 'sent': return 'bg-blue-100 text-blue-700'
    case 'signed': return 'bg-emerald-100 text-emerald-700'
    case 'declined': return 'bg-red-100 text-red-700'
    case 'expired': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function formatDate(s: string | null): string | null {
  if (!s) return null
  try {
    return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return null
  }
}

export function ContractsSection({ contracts }: ContractsSectionProps) {
  if (contracts.length === 0) {
    return (
      <div className="border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-600">No contracts yet. Your MC will send them here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {contracts.map((c) => {
        const isSigned = c.status === 'signed'
        const sentDate = formatDate(c.email_sent_at)
        const signedDate = formatDate(c.signed_at)
        return (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500 mt-1">Contract #{c.contract_number}</p>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor(c.status)}`}>
                {c.status}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500 space-y-0.5">
                {sentDate && <p>Sent {sentDate}</p>}
                {signedDate && <p>Signed {signedDate}</p>}
              </div>
              {c.share_token_enabled && c.share_token ? (
                <a
                  href={`/contract/${c.share_token}`}
                  className="flex items-center gap-2 text-xs font-medium text-black hover:text-gray-700 transition shrink-0"
                >
                  {isSigned ? 'View signed' : 'Review & sign'} <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-xs text-gray-400 shrink-0">Not yet shared</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
