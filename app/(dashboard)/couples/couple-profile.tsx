'use client'

import { useState } from 'react'
import { X, Phone, Mail, MessageCircle, Pencil } from 'lucide-react'
import { Couple, STATUS_LABELS, STATUS_DOT_COLORS } from './couples-types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { CoupleOverview } from './couple-overview'
import { CoupleVendors } from './couple-vendors'
import { CoupleTasks } from './couple-tasks'

interface CoupleProfileProps {
  couple: Couple | null
  onClose: () => void
  onEdit: (couple: Couple) => void
}

export function CoupleProfile({ couple, onClose, onEdit }: CoupleProfileProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'tasks'>('overview')

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

        {/* Tabs */}
        <div className="flex-shrink-0 border-t border-b border-gray-200 px-8">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                activeTab === 'vendors'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                activeTab === 'tasks'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Tasks
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          {activeTab === 'overview' && <CoupleOverview couple={couple} />}
          {activeTab === 'vendors' && <CoupleVendors coupleId={couple.id} />}
          {activeTab === 'tasks' && <CoupleTasks coupleId={couple.id} />}
        </div>
      </div>
    </>
  )
}
