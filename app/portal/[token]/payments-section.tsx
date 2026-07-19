'use client'

import { ExternalLink } from 'lucide-react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { isPastDue } from '@/lib/utils'

import { PortalProposal, PortalInvoice } from './page'

interface PaymentsSectionProps {
  payments: {
    proposals?: PortalProposal[]
    /** Legacy key the RPC keeps returning until the quotes drop
     *  migration deploys - ignored by this component. */
    quotes?: unknown[]
    invoices: PortalInvoice[]
  }
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

function getStatusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'draft':
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    case 'sent':
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    case 'accepted':
      return { bg: `${STATUS_COLORS.success}20`, fg: STATUS_COLORS.success }
    case 'declined':
      return { bg: `${STATUS_COLORS.error}20`, fg: STATUS_COLORS.error }
    case 'expired':
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    case 'paid':
      return { bg: `${STATUS_COLORS.success}20`, fg: STATUS_COLORS.success }
    case 'overdue':
      return { bg: `${STATUS_COLORS.error}20`, fg: STATUS_COLORS.error }
    default:
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
  }
}

function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value)
}

const isOverdue = isPastDue

export function PaymentsSection({ payments, branding }: PaymentsSectionProps) {
  const proposals = payments.proposals ?? []
  const hasProposals = proposals.length > 0
  const hasInvoices = payments.invoices.length > 0
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  if (!hasProposals && !hasInvoices) {
    return (
      <div
        className="rounded-card p-6 text-center"
        style={{
          border: `1px solid ${branding.border_color}`,
          backgroundColor: branding.surface_color,
        }}
      >
        <p
          style={{
            fontSize: `${bodyDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          Nothing here yet. Your MC will send proposals and invoices here.
        </p>
      </div>
    )
  }

  // Calculate summary
  const totalProposals = proposals.reduce((sum, p) => sum + p.subtotal, 0)
  const totalInvoices = payments.invoices.reduce((sum, i) => sum + i.subtotal, 0)
  const overdueInvoices = payments.invoices.filter(
    (i) => i.status !== 'paid' && i.status !== 'cancelled' && isOverdue(i.due_date)
  )

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      {(totalProposals > 0 || totalInvoices > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {totalProposals > 0 && (
            <div
              className="rounded-card p-3"
              style={{
                border: `1px solid ${branding.border_color}`,
                backgroundColor: branding.surface_color,
              }}
            >
              <p
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Total proposals
              </p>
              <p
                className="mt-1 font-semibold"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {formatAUD(totalProposals)}
              </p>
            </div>
          )}
          {totalInvoices > 0 && (
            <div
              className="rounded-card p-3"
              style={{
                border: `1px solid ${branding.border_color}`,
                backgroundColor: branding.surface_color,
              }}
            >
              <p
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Total invoices
              </p>
              <p
                className="mt-1 font-semibold"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {formatAUD(totalInvoices)}
              </p>
            </div>
          )}
          {overdueInvoices.length > 0 && (
            <div
              className="rounded-card p-3"
              style={{
                border: `1px solid ${STATUS_COLORS.error}20`,
                backgroundColor: `${STATUS_COLORS.error}10`,
              }}
            >
              <p
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: STATUS_COLORS.error,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Overdue
              </p>
              <p
                className="mt-1 font-semibold"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: STATUS_COLORS.error,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {overdueInvoices.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Proposals */}
      {hasProposals && (
        <div>
          <h3
            className="font-medium mb-3"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: 500,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Proposals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {proposals.map((proposal) => {
              const statusColor = getStatusColor(proposal.status)
              return (
                <div
                  key={proposal.id}
                  className="rounded-card p-4 flex flex-col"
                  style={{
                    border: `1px solid ${branding.border_color}`,
                    backgroundColor: branding.surface_color,
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-medium"
                        style={{
                          fontSize: `${bodyDefaults.fontSize}px`,
                          color: bodyDefaults.color,
                          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: bodyDefaults.lineHeight,
                        }}
                      >
                        {proposal.title}
                      </p>
                      <p
                        className="mt-0.5"
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: finePrintDefaults.color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: finePrintDefaults.fontWeight,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        Proposal #{proposal.proposal_number}
                      </p>
                    </div>
                    <span
                      className="shrink-0 font-medium px-2 py-1 capitalize"
                      style={{
                        fontSize: `${finePrintDefaults.fontSize}px`,
                        color: statusColor.fg,
                        backgroundColor: statusColor.bg,
                        fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                        fontWeight: 500,
                        lineHeight: finePrintDefaults.lineHeight,
                        borderRadius: branding.corner_radius,
                      }}
                    >
                      {proposal.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3">
                    <p
                      className="font-semibold"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: 600,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {formatAUD(proposal.subtotal)}
                    </p>
                    {proposal.share_token_enabled && proposal.share_token ? (
                      <a
                        href={`/proposal/${proposal.share_token}`}
                        className="inline-flex items-center gap-1.5 font-medium transition cursor-pointer hover:opacity-75"
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: branding.brand_color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        View <ExternalLink size={13} strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: finePrintDefaults.color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: finePrintDefaults.fontWeight,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        Not yet shared
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invoices */}
      {hasInvoices && (
        <div>
          <h3
            className="font-medium mb-3"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: 500,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Invoices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {payments.invoices.map((invoice) => {
              const overdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && isOverdue(invoice.due_date)
              return (
                <div
                  key={invoice.id}
                  className="rounded-card p-4 flex flex-col"
                  style={{
                    border: `1px solid ${overdue ? STATUS_COLORS.error : branding.border_color}30`,
                    backgroundColor: overdue ? `${STATUS_COLORS.error}10` : branding.surface_color,
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-medium"
                        style={{
                          fontSize: `${bodyDefaults.fontSize}px`,
                          color: overdue ? STATUS_COLORS.error : bodyDefaults.color,
                          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: bodyDefaults.lineHeight,
                        }}
                      >
                        {invoice.title}
                      </p>
                      <p
                        className="mt-0.5"
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: finePrintDefaults.color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: finePrintDefaults.fontWeight,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        Invoice #{invoice.invoice_number}
                      </p>
                    </div>
                    {overdue && (
                      <span
                        className="shrink-0 font-medium px-2 py-1"
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: 'white',
                          backgroundColor: STATUS_COLORS.error,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: finePrintDefaults.lineHeight,
                          borderRadius: branding.corner_radius,
                        }}
                      >
                        Overdue
                      </span>
                    )}
                  </div>
                  {invoice.due_date && (
                    <p
                      className="mb-3"
                      style={{
                        fontSize: `${finePrintDefaults.fontSize}px`,
                        color: overdue ? STATUS_COLORS.error : finePrintDefaults.color,
                        fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                        fontWeight: overdue ? 500 : finePrintDefaults.fontWeight,
                        lineHeight: finePrintDefaults.lineHeight,
                      }}
                    >
                      Due {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-AU')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <p
                      className="font-semibold"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: 600,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {formatAUD(invoice.subtotal)}
                    </p>
                    {invoice.share_token_enabled && invoice.share_token ? (
                      <a
                        href={`/invoice/${invoice.share_token}`}
                        className="inline-flex items-center gap-1.5 font-medium transition cursor-pointer hover:opacity-75"
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: branding.brand_color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        View <ExternalLink size={13} strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: `${finePrintDefaults.fontSize}px`,
                          color: finePrintDefaults.color,
                          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                          fontWeight: finePrintDefaults.fontWeight,
                          lineHeight: finePrintDefaults.lineHeight,
                        }}
                      >
                        Not yet shared
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
