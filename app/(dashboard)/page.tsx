'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useUpcomingWeddingsWithDefault, useRecentCouplesWithDefault, useDashboardStats } from './use-dashboard'
import { DashboardStats } from './dashboard-stats'
import { DashboardUpcomingWeddings } from './dashboard-upcoming-weddings'
import { DashboardRecentCouples } from './dashboard-recent-couples'
import { CoupleProfile } from './couples/couple-profile'
import { CoupleModal } from './couples/couple-modal'
import { VendorModal } from './vendors/vendor-modal'
import { useCreateCouple } from './couples/use-couples'
import { useCreateVendor } from './vendors/use-vendors'
import { Couple } from './couples/couples-types'

export default function DashboardPage() {
  const { data: upcomingEvents, isLoading: upcomingLoading } = useUpcomingWeddingsWithDefault()
  const { data: recentCouples, isLoading: recentCouplesLoading } = useRecentCouplesWithDefault()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null)

  // Modal state
  const [showAddCoupleModal, setShowAddCoupleModal] = useState(false)
  const [showAddVendorModal, setShowAddVendorModal] = useState(false)

  // Mutations
  const createCouple = useCreateCouple()
  const createVendor = useCreateVendor()

  // Handlers
  const handleSaveCouple = async (data: any) => {
    await createCouple.mutateAsync(data)
    setShowAddCoupleModal(false)
  }

  const handleSaveVendor = async (data: any) => {
    await createVendor.mutateAsync(data)
    setShowAddVendorModal(false)
  }

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-6 flex items-center justify-between flex-shrink-0">
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddVendorModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Vendor
          </button>
          <button
            onClick={() => setShowAddCoupleModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Couple
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-12">
        <div className="space-y-4 px-6">
          <DashboardStats
            newEnquiries={stats?.newEnquiries || 0}
            newEnquiriesChange={stats?.newEnquiriesChange ?? null}
            newEnquiriesSparkline={stats?.newEnquiriesSparkline || Array(7).fill(0)}
            openTasks={stats?.openTasks || 0}
            openTasksChange={stats?.openTasksChange ?? null}
            openTasksSparkline={stats?.openTasksSparkline || Array(7).fill(0)}
            upcomingWeddings={stats?.upcomingWeddings || 0}
            upcomingChange={stats?.upcomingChange ?? null}
            upcomingSparkline={stats?.upcomingSparkline || Array(7).fill(0)}
            completedWeddings={stats?.completedWeddings || 0}
            completedChange={stats?.completedChange ?? null}
            completedSparkline={stats?.completedSparkline || Array(7).fill(0)}
            vendorCount={stats?.vendorCount || 0}
            vendorChange={stats?.vendorChange ?? null}
            vendorSparkline={stats?.vendorSparkline || Array(7).fill(0)}
            dueThisWeek={stats?.dueThisWeek || 0}
            dueThisWeekChange={stats?.dueThisWeekChange ?? null}
            dueThisWeekSparkline={stats?.dueThisWeekSparkline || Array(7).fill(0)}
            isLoading={statsLoading}
          />

          <div className="grid grid-cols-2 gap-4 h-96">
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
      </div>

      {/* Profile slide-over */}
      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onEdit={() => {
          // Edit is handled in the CoupleProfile component
        }}
      />

      {/* Modals */}
      <CoupleModal
        isOpen={showAddCoupleModal}
        onClose={() => setShowAddCoupleModal(false)}
        onSave={handleSaveCouple}
        onDelete={async () => {}}
        loading={createCouple.isPending}
      />
      <VendorModal
        isOpen={showAddVendorModal}
        onClose={() => setShowAddVendorModal(false)}
        onSave={handleSaveVendor}
        onDelete={async () => {}}
        loading={createVendor.isPending}
      />
    </div>
  )
}
