'use client'

import { Clock } from 'lucide-react'

export function NotificationsSection() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Clock size={40} strokeWidth={1.5} className="text-gray-300 mb-4" />
      <p className="text-sm text-gray-400">Coming soon</p>
    </div>
  )
}
