"use client";

import { useState } from "react";

import { CoupleProfile } from "@/app/(dashboard)/couples/couple-profile";
import { useCouples } from "@/app/(dashboard)/couples/use-couples";
import {
  useUpdateCouple,
  useDeleteCouple,
} from "@/app/(dashboard)/couples/use-couples";
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from "@/components/ui/toast";
import { Couple } from '@/types/couple';

import { CouplesCalendar } from "./_components/couples-calendar";
import { AvailabilityTab } from "./availability-tab";
import { BookingDetailPanel } from "./booking-detail-panel";
import { BookingsTab } from "./bookings-tab";
import { CalendarConnectionBanner } from "./calendar-connection-banner";
import { CalendarTabs, type CalendarTab } from "./calendar-tabs";
import { MeetingTypesTab } from "./meeting-types-tab";
import { ShareBookingLinkButton } from "./share-booking-link-button";
import { useAvailability } from "./use-availability";
import type { Booking } from "./use-bookings";
import { useCalendarConnectResult } from "./use-calendar-connect-result";

export default function CalendarPage() {
  const { data: couples } = useCouples();
  const { data: availabilityData } = useAvailability();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const { toast } = useToast();

  // Announces the result when a connect flow started on this page comes back.
  useCalendarConnectResult();

  const [activeTab, setActiveTab] = useState<CalendarTab>('calendar');
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const handleSelectCouple = (coupleId: string) => {
    const couple = couples.find((c) => c.id === coupleId);
    if (couple) setSelectedCouple(couple);
  };

  const handleSaveCouple = async (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => {
    const couple = selectedCouple;
    if (data.id && couple) {
      const updated = { ...couple, ...data };
      await updateCouple.mutateAsync(updated);
      setSelectedCouple(updated);
      toast("Couple updated");
    }
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    if (selectedCouple?.id === id) {
      setSelectedCouple(null);
    }
    toast("Couple deleted");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-4 pb-4 md:px-[3.75rem] md:pt-6 md:pb-6 shrink-0">
        <PageHeader
          title="Calendar"
          // Only on the Bookings tab: sharing a link is the next move once
          // you have read the list, and it means nothing on the other three.
          {...(activeTab === 'bookings' && { actions: <ShareBookingLinkButton /> })}
        />
      </div>

      <div className="px-6 md:px-[3.75rem] shrink-0">
        <CalendarConnectionBanner />
      </div>

      <div className="px-6 md:px-[3.75rem] shrink-0 border-b border-border">
        <CalendarTabs active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex-1 min-h-0 px-6 pt-4 pb-4 md:px-[3.75rem] md:pt-6 md:pb-6 overflow-hidden">
        {activeTab === 'calendar' && (
          <div className="h-full overflow-hidden">
            <CouplesCalendar onSelectCouple={handleSelectCouple} onSelectBooking={setSelectedBooking} />
          </div>
        )}
        {activeTab === 'meeting-types' && <MeetingTypesTab />}
        {activeTab === 'availability' && <AvailabilityTab />}
        {activeTab === 'bookings' && (
          <BookingsTab onSelectBooking={setSelectedBooking} />
        )}
      </div>

      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onSave={handleSaveCouple}
        onDelete={handleDeleteCouple}
        loading={updateCouple.isPending || deleteCouple.isPending}
      />

      <BookingDetailPanel
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        mcTimezone={availabilityData?.timezone ?? 'Australia/Sydney'}
        onSelectCouple={(coupleId) => {
          setSelectedBooking(null);
          handleSelectCouple(coupleId);
        }}
        {...(selectedBooking && { booking: selectedBooking })}
      />
    </div>
  );
}
