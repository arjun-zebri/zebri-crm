/**
 * Info panel for the public booking page (left side).
 *
 * Displays the MC's name, meeting type, duration, and location details with
 * semantic icons (clock, map pin, video, phone). Designed for the branded
 * public surface with the MC's text styling.
 *
 * @module app/book/[token]/booking-info-panel
 */

'use client'

import { Clock, MapPin, Phone, Video } from 'lucide-react'

import type { BookingPageData } from './use-booking-page'

export interface BookingInfoPanelProps {
  bookingPage: BookingPageData
}

/**
 * Renders the MC's meeting details with semantic icons and locations.
 */
export function BookingInfoPanel({ bookingPage }: BookingInfoPanelProps) {
  const { business_name, name, duration_minutes, location_type, address } = bookingPage

  const locationLabel =
    location_type === 'in_person' ? 'In-person' : location_type === 'video' ? 'Video call' : 'Phone call'
  const locationDisplay =
    location_type === 'in_person' && address ? address : locationLabel

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-text-muted">{business_name}</p>
        <p className="text-lg font-bold text-text mt-2">{name}</p>
      </div>

      <div className="space-y-3">
        {/* Duration */}
        <div className="flex items-center gap-2">
          <Clock size={16} strokeWidth={1.5} className="text-text-muted flex-shrink-0" />
          <span className="text-sm text-text">{duration_minutes} min</span>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2">
          {location_type === 'video' ? (
            <Video size={16} strokeWidth={1.5} className="text-text-muted flex-shrink-0 mt-0.5" />
          ) : location_type === 'phone' ? (
            <Phone size={16} strokeWidth={1.5} className="text-text-muted flex-shrink-0 mt-0.5" />
          ) : (
            <MapPin size={16} strokeWidth={1.5} className="text-text-muted flex-shrink-0 mt-0.5" />
          )}
          <span className="text-sm text-text">{locationDisplay}</span>
        </div>
      </div>
    </div>
  )
}
