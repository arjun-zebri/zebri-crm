'use client'

import { Contact, CATEGORY_LABELS, STATUS_LABELS } from './contacts-types'
import { Badge } from '@/components/ui/badge'

interface ContactOverviewProps {
  vendor: Contact
  onEditClick: () => void
}

export function ContactOverview({ vendor, onEditClick }: ContactOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Contact Details Section */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Contact details</h3>
        <div className="space-y-3">
          {vendor.phone && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Phone</span>
              <a
                href={`tel:${vendor.phone}`}
                className="text-sm text-gray-900 hover:text-blue-600 transition"
              >
                {vendor.phone}
              </a>
            </div>
          )}

          {vendor.email && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <a
                href={`mailto:${vendor.email}`}
                className="text-sm text-gray-900 hover:text-blue-600 transition"
              >
                {vendor.email}
              </a>
            </div>
          )}

          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-500">Category</span>
            <Badge variant={vendor.category as any}>
              {CATEGORY_LABELS[vendor.category]}
            </Badge>
          </div>

          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  vendor.status === 'active' ? 'bg-emerald-400' : 'bg-gray-300'
                }`}
              />
              <span className="text-sm text-gray-900">{STATUS_LABELS[vendor.status]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Notes</h3>
        {vendor.notes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{vendor.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No notes yet.</p>
        )}
      </div>
    </div>
  )
}
