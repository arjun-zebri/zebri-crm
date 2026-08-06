/**
 * Inline health callout. Only renders when there's something to
 * flag (errored runs in the last 7 days). Linking through goes to
 * the first erroring automation's canvas builder.
 *
 * Style follows the warning-tinted banners already used elsewhere
 * (bg-warning/10, text-warning, subtle border, no harsh chrome).
 *
 * @module app/(dashboard)/automations/health-banner
 */
'use client'

import { AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Props {
  erroredCount: number
  firstErrorAutomationId: string | null
  firstErrorAutomationName: string | null
}

export function HealthBanner({ erroredCount, firstErrorAutomationId, firstErrorAutomationName }: Props) {
  if (erroredCount === 0) return null

  const noun = erroredCount === 1 ? 'automation has' : 'automations have'
  const detail = firstErrorAutomationName ? ` - ${firstErrorAutomationName}` : ''

  const body = (
    <span className="inline-flex items-center gap-2">
      <AlertTriangle size={14} strokeWidth={1.5} />
      <span>
        {erroredCount} {noun} errored in the last 7 days{detail}
      </span>
      <ChevronRight size={14} strokeWidth={1.5} className="text-warning/60" />
    </span>
  )

  if (!firstErrorAutomationId) {
    return (
      <div className="bg-warning/10 text-warning text-xs px-3 py-2 rounded-control">{body}</div>
    )
  }
  return (
    <Link
      href={`/automations/${firstErrorAutomationId}`}
      className="block bg-warning/10 text-warning text-xs px-3 py-2 rounded-control hover:bg-warning/15 transition cursor-pointer"
    >
      {body}
    </Link>
  )
}
