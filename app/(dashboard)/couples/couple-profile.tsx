'use client'

import { X, Phone, Mail, MessageCircle, Pencil } from 'lucide-react'
import { Couple, STATUS_LABELS, STATUS_DOT_COLORS } from './couples-types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface CoupleProfileProps {
  couple: Couple | null
  onClose: () => void
  onEdit: (couple: Couple) => void
}

export function CoupleProfile({ couple, onClose, onEdit }: CoupleProfileProps) {
  if (!couple) return null

  const hasPhone = !!couple.phone
  const hasEmail = !!couple.email

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[640px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-6 pb-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-semibold text-gray-900 truncate">{couple.name}</h1>
                <Badge variant={couple.status as any}>
                  {STATUS_LABELS[couple.status]}
                </Badge>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2">
            <a
              href={hasPhone ? `tel:${couple.phone}` : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition ${
                hasPhone
                  ? 'text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer'
                  : 'text-gray-300 border-gray-100 cursor-not-allowed'
              }`}
              onClick={hasPhone ? undefined : (e) => e.preventDefault()}
            >
              <Phone size={14} />
              Call
            </a>
            <a
              href={hasEmail ? `mailto:${couple.email}` : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition ${
                hasEmail
                  ? 'text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer'
                  : 'text-gray-300 border-gray-100 cursor-not-allowed'
              }`}
              onClick={hasEmail ? undefined : (e) => e.preventDefault()}
            >
              <Mail size={14} />
              Email
            </a>
            <a
              href={hasPhone ? `https://wa.me/${couple.phone.replace(/\D/g, '')}` : undefined}
              target={hasPhone ? '_blank' : undefined}
              rel={hasPhone ? 'noopener noreferrer' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition ${
                hasPhone
                  ? 'text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer'
                  : 'text-gray-300 border-gray-100 cursor-not-allowed'
              }`}
              onClick={hasPhone ? undefined : (e) => e.preventDefault()}
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <button
              onClick={() => onEdit(couple)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer ml-auto"
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-gray-200 px-8 py-6">
          <div className="space-y-6">
            {/* Contact details */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Details</h3>
              <div className="space-y-3">
                {couple.phone && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-500">Phone</span>
                    <a href={`tel:${couple.phone}`} className="text-sm text-gray-900 hover:text-blue-600 transition">{couple.phone}</a>
                  </div>
                )}
                {couple.email && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-500">Email</span>
                    <a href={`mailto:${couple.email}`} className="text-sm text-gray-900 hover:text-blue-600 transition">{couple.email}</a>
                  </div>
                )}
                {couple.event_date && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-500">Event date</span>
                    <span className="text-sm text-gray-900">{formatDate(couple.event_date)}</span>
                  </div>
                )}
                {couple.venue && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-500">Venue</span>
                    <span className="text-sm text-gray-900">{couple.venue}</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge variant={couple.status as any}>
                    {STATUS_LABELS[couple.status]}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Notes</h3>
              {couple.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{couple.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
