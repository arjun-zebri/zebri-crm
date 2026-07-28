'use client'

import { Check, ExternalLink } from 'lucide-react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { PortalQuestionnaire } from './page'

interface QuestionnairesSectionProps {
  questionnaires: PortalQuestionnaire[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'completed':
      return { bg: `${STATUS_COLORS.success}20`, fg: STATUS_COLORS.success }
    case 'sent':
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
    default:
      return { bg: `${STATUS_COLORS.warning}20`, fg: STATUS_COLORS.warning }
  }
}

/**
 * Questionnaires section: lists the questionnaires the MC has sent, each
 * linking out to the standalone fill-in page (`/questionnaire/[token]`).
 * Completed ones show a success tint; the rest invite the couple to start.
 */
export function QuestionnairesSection({ questionnaires, branding }: QuestionnairesSectionProps) {
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  if (questionnaires.length === 0) {
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
          No questionnaires yet. Your MC will send them here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {questionnaires.map((q) => {
        const isDone = q.status === 'completed'
        const statusStyle = statusColor(q.status)
        return (
          <div
            key={q.id}
            className="flex flex-col rounded-card p-4"
            style={{
              border: `1px solid ${isDone ? STATUS_COLORS.success : branding.border_color}30`,
              backgroundColor: isDone ? `${STATUS_COLORS.success}10` : branding.surface_color,
            }}
          >
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <p
                className="min-w-0 flex-1 font-medium"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: 500,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {q.title}
              </p>
              <span
                className="flex shrink-0 items-center gap-1 px-2 py-1 font-medium capitalize"
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
                {isDone && <Check size={13} strokeWidth={1.5} />}
                {q.status}
              </span>
            </div>

            {q.share_token_enabled && q.share_token ? (
              <a
                href={`/questionnaire/${q.share_token}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-medium transition cursor-pointer sm:w-auto hover:opacity-90"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: isDone ? branding.brand_color : 'white',
                  backgroundColor: isDone ? 'transparent' : branding.brand_color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: 500,
                  lineHeight: finePrintDefaults.lineHeight,
                  borderRadius: branding.corner_radius,
                }}
              >
                {isDone ? 'View answers' : 'Fill it in'} <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            ) : (
              <p
                className="px-3 py-2 text-center"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Not yet shared
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
