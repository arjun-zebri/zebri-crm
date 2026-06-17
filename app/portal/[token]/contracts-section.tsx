'use client'

import { Check, Mail, ExternalLink } from 'lucide-react'

import { PortalContract } from './page'

interface ContractsSectionProps {
  contracts: PortalContract[]
}

function statusColor(status: string): string {
  switch (status) {
    case 'sent': return 'bg-info/10 text-info'
    case 'signed': return 'bg-success/10 text-success'
    case 'declined': return 'bg-danger/10 text-danger'
    case 'expired': return 'bg-warning/10 text-warning'
    default: return 'bg-surface-muted text-text-muted'
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

/**
 * Contracts section: displays contracts in a responsive grid with signing status.
 * Unsigned contracts show prominent "Review & sign" button. Signed contracts show success tint and check.
 */
export function ContractsSection({ contracts }: ContractsSectionProps) {
  if (contracts.length === 0) {
    return (
      <div className="border border-border rounded-card p-6 text-center">
        <p className="text-body text-text-muted">No contracts yet. Your MC will send them here.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      {contracts.map((c) => {
        const isSigned = c.status === 'signed'
        const sentDate = formatDate(c.email_sent_at)
        const signedDate = formatDate(c.signed_at)
        return (
          <div
            key={c.id}
            className={`border rounded-card p-4 flex flex-col ${
              isSigned
                ? 'bg-success/5 border-success/30'
                : 'bg-surface border-border hover:border-border-strong'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-text">{c.title}</p>
                <p className="text-caption text-text-subtle mt-0.5">Contract #{c.contract_number}</p>
              </div>
              <span className={`shrink-0 text-caption font-medium px-2 py-1 rounded-pill capitalize flex items-center gap-1 ${statusColor(c.status)}`}>
                {isSigned && <Check size={13} strokeWidth={1.5} />}
                {c.status}
              </span>
            </div>

            <div className="text-caption text-text-subtle space-y-0.5 mb-3 flex-1">
              <div className="flex items-center gap-1">
                <Mail size={13} strokeWidth={1.5} />
                {sentDate ? <p>Sent {sentDate}</p> : <p>Not yet shared</p>}
              </div>
              {isSigned && signedDate && (
                <div className="flex items-center gap-1 text-success">
                  <Check size={13} strokeWidth={1.5} />
                  Signed {signedDate}
                </div>
              )}
            </div>

            {c.share_token_enabled && c.share_token ? (
              <a
                href={`/contract/${c.share_token}`}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-caption font-medium rounded-control px-3 py-2 transition cursor-pointer ${
                  isSigned
                    ? 'text-brand-fg hover:text-text-muted'
                    : 'bg-brand-fg text-text-inverse hover:opacity-90'
                }`}
              >
                {isSigned ? 'View signed' : 'Review & sign'} <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            ) : (
              <div className="text-caption text-text-subtle px-3 py-2 text-center">
                <p>Not yet shared</p>
                <p className="text-text-muted mt-0.5">Ask your MC to send this contract</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
