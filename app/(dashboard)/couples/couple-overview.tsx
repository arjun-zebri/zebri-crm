'use client'

import { Couple, CoupleStatusRecord, LEAD_SOURCE_LABELS, LeadSource, getStatusClasses } from './couples-types'

interface CoupleOverviewProps {
  couple: Couple
  statuses: CoupleStatusRecord[]
}

export function CoupleOverview({ couple, statuses }: CoupleOverviewProps) {
  const status = statuses.find(s => s.slug === couple.status)
  const statusName = status?.name || couple.status.charAt(0).toUpperCase() + couple.status.slice(1)
  const statusClasses = status ? getStatusClasses(status.color) : getStatusClasses('gray')
  const leadSourceLabel = couple.lead_source
    ? LEAD_SOURCE_LABELS[couple.lead_source as LeadSource] ?? couple.lead_source
    : null

  const fields = [
    {
      label: 'Phone',
      render: couple.phone ? (
        <a href={`tel:${couple.phone}`} className="text-sm text-gray-900 hover:text-blue-600 transition">
          {couple.phone}
        </a>
      ) : null,
      value: couple.phone || null,
    },
    {
      label: 'Email',
      render: couple.email ? (
        <a href={`mailto:${couple.email}`} className="text-sm text-gray-900 hover:text-blue-600 transition truncate max-w-[60%] text-right">
          {couple.email}
        </a>
      ) : null,
      value: couple.email || null,
    },
    {
      label: 'Status',
      render: (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses.pill}`}>
          {statusName}
        </span>
      ),
      value: 'status',
    },
    {
      label: 'Lead source',
      render: null,
      value: leadSourceLabel,
    },
  ]

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Fields */}
      <div>
        {fields.map(({ label, render, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm text-gray-400 shrink-0">{label}</span>
            {render ? (
              render
            ) : value ? (
              <span className="text-sm text-gray-900">{value}</span>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Notes — expands to fill remaining height */}
      <div className="flex flex-col flex-1 min-h-0 pt-2.5">
        <span className="text-sm text-gray-400 mb-2">Notes</span>
        <div className="flex-1">
          {couple.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{couple.notes}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
