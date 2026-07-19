'use client'

import { Check, Mail, ExternalLink } from 'lucide-react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

import { PortalContract } from './page'

interface ContractsSectionProps {
  contracts: PortalContract[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'sent': return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    case 'signed': return { bg: `${STATUS_COLORS.success}20`, fg: STATUS_COLORS.success }
    case 'declined': return { bg: `${STATUS_COLORS.error}20`, fg: STATUS_COLORS.error }
    case 'expired': return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    default: return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
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
 * Unsigned contracts show prominent Review & sign button. Signed contracts show success tint and check.
 */
export function ContractsSection({ contracts, branding }: ContractsSectionProps) {
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  if (contracts.length === 0) {
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
          No contracts yet. Your MC will send them here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      {contracts.map((c) => {
        const isSigned = c.status === 'signed'
        const sentDate = formatDate(c.email_sent_at)
        const signedDate = formatDate(c.signed_at)
        const statusStyle = statusColor(c.status)
        return (
          <div
            key={c.id}
            className="rounded-card p-4 flex flex-col"
            style={{
              border: `1px solid ${isSigned ? STATUS_COLORS.success : branding.border_color}30`,
              backgroundColor: isSigned ? `${STATUS_COLORS.success}10` : branding.surface_color,
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
                  {c.title}
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
                  Contract #{c.contract_number}
                </p>
              </div>
              <span
                className="shrink-0 font-medium px-2 py-1 capitalize flex items-center gap-1"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: statusStyle.fg,
                  backgroundColor: statusStyle.bg,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: 500,
                  lineHeight: finePrintDefaults.lineHeight,
                  borderRadius: branding.corner_radius,
                }}
              >
                {isSigned && <Check size={13} strokeWidth={1.5} />}
                {c.status}
              </span>
            </div>

            <div
              className="space-y-0.5 mb-3 flex-1"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              <div className="flex items-center gap-1">
                <Mail size={13} strokeWidth={1.5} />
                <p>{sentDate ? `Sent ${sentDate}` : 'Not yet shared'}</p>
              </div>
              {isSigned && signedDate && (
                <div className="flex items-center gap-1" style={{ color: STATUS_COLORS.success }}>
                  <Check size={13} strokeWidth={1.5} />
                  Signed {signedDate}
                </div>
              )}
            </div>

            {c.share_token_enabled && c.share_token ? (
              <a
                href={`/contract/${c.share_token}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-medium rounded-xl px-3 py-2 transition cursor-pointer hover:opacity-90"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: isSigned ? branding.brand_color : 'white',
                  backgroundColor: isSigned ? 'transparent' : branding.brand_color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: 500,
                  lineHeight: finePrintDefaults.lineHeight,
                  borderRadius: branding.corner_radius,
                }}
              >
                {isSigned ? 'View signed' : 'Review & sign'} <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            ) : (
              <div
                className="px-3 py-2 text-center"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                <p>Not yet shared</p>
                <p
                  className="mt-0.5"
                  style={{
                    color: finePrintDefaults.color,
                    opacity: 0.75,
                  }}
                >
                  Ask your MC to send this contract
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
