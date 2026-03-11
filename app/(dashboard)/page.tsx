'use client'

import { useState } from 'react'
import { useUpcomingWeddingsWithDefault, useRecentCouplesWithDefault, useDashboardStats } from './use-dashboard'
import { DashboardStats } from './dashboard-stats'
import { DashboardQuickActions } from './dashboard-quick-actions'
import { DashboardUpcomingWeddings } from './dashboard-upcoming-weddings'
import { DashboardRecentCouples } from './dashboard-recent-couples'
import { DashboardRecentActivity } from './dashboard-recent-activity'
import { CoupleProfile } from './couples/couple-profile'
import { CoupleModal } from './couples/couple-modal'
import { Couple } from './couples/couples-types'
import { useCreateCouple } from './couples/use-couples'

export default function DashboardPage() {
  const { data: upcomingEvents, isLoading: upcomingLoading } = useUpcomingWeddingsWithDefault()
  const { data: recentCouples, isLoading: recentCouplesLoading } = useRecentCouplesWithDefault()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const createCouple = useCreateCouple()
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null)
  const [showAddCoupleModal, setShowAddCoupleModal] = useState(false)

  const handleEventClick = (coupleData: { id: string; name: string }) => {
    // Find the full couple object from recentCouples
    const couple = (recentCouples || []).find((c) => c.id === coupleData.id)
    if (couple) {
      setSelectedCouple(couple)
    } else {
      // If not in recent couples, we still need to open the profile
      // For now, just use the basic data provided
      setSelectedCouple({
        id: coupleData.id,
        name: coupleData.name,
        user_id: '',
        email: '',
        phone: '',
        event_date: null,
        venue: '',
        notes: '',
        status: 'new',
        created_at: new Date().toISOString(),
      })
    }
  }

  const handleSaveCouple = async (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => {
    await createCouple.mutateAsync(data)
    setShowAddCoupleModal(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3">
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="space-y-6">
          <DashboardStats
            totalCouples={stats?.totalCouples || 0}
            couplesChange={stats?.couplesChange || 0}
            couplesPercent={stats?.couplesPercent || 0}
            activeVendors={stats?.activeVendors || 0}
            weddingsThisMonth={stats?.weddingsThisMonth || 0}
            weddingsChange={stats?.weddingsChange || 0}
            weddingsPercent={stats?.weddingsPercent || 0}
            isLoading={statsLoading}
          />

          <div className="grid grid-cols-2 gap-6">
            <DashboardQuickActions onAddCouple={() => setShowAddCoupleModal(true)} />
            <DashboardRecentActivity
              couples={recentCouples}
              isLoading={recentCouplesLoading}
              onCoupleClick={setSelectedCouple}
            />
          </div>

          <DashboardUpcomingWeddings
            events={upcomingEvents}
            isLoading={upcomingLoading}
            onEventClick={handleEventClick}
          />
          <DashboardRecentCouples
            couples={recentCouples}
            isLoading={recentCouplesLoading}
            onCoupleClick={setSelectedCouple}
          />
        </div>
      </div>

      {/* Profile slide-over */}
      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onEdit={() => {
          // Edit is handled in the CoupleProfile component
        }}
      />

      {/* Add couple modal */}
      <CoupleModal
        isOpen={showAddCoupleModal}
        onClose={() => setShowAddCoupleModal(false)}
        onSave={handleSaveCouple}
        onDelete={async () => {}}
        loading={createCouple.isPending}
      />
    </div>
  )
}
