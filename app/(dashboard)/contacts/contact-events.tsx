"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { X, Search, Trash2, Edit2 } from "lucide-react";
import { EventModal } from "../couples/event-modal";
import { Event } from "../events/events-types";

interface ContactEventsProps {
  vendorId: string;
}

interface EventVendorRow {
  id: string;
  event: {
    id: string;
    date: string;
    venue: string;
    couple: {
      name: string;
    } | null;
  } | null;
}

interface AvailableEvent {
  id: string;
  date: string;
  venue: string;
  couple: {
    name: string;
  } | null;
}

interface CoupleSummary {
  id: string;
  name: string;
}

export function ContactEvents({ vendorId }: ContactEventsProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCoupleSelector, setShowCoupleSelector] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCoupleId, setSelectedCoupleId] = useState<string | null>(null);
  const [coupleSearch, setCoupleSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [createEventLoading, setCreateEventLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [editingVendorIds, setEditingVendorIds] = useState<string[]>([]);

  // When couple is selected, show the EventModal
  useEffect(() => {
    if (selectedCoupleId && showCoupleSelector) {
      setShowCoupleSelector(false);
      setShowEventModal(true);
    }
  }, [selectedCoupleId, showCoupleSelector]);

  const { data: eventVendors, isLoading } = useQuery({
    queryKey: ["contact-events", vendorId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("event_contacts")
        .select(
          `
          id,
          event:event_id(id, date, venue, couple:couple_id(name))
        `
        )
        .eq("contact_id", vendorId)
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as EventVendorRow[]) || [];
    },
  });

  const { data: availableEvents, isLoading: availableLoading } = useQuery({
    queryKey: ["contact-available-events", vendorId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data: allEvents, error: eventsError } = await supabase
        .from("events")
        .select("id, date, venue, couple:couple_id(name)")
        .eq("user_id", user.user.id)
        .order("date", { ascending: false });

      if (eventsError) throw eventsError;

      const { data: linkedEvents, error: linkedError } = await supabase
        .from("event_contacts")
        .select("event_id")
        .eq("contact_id", vendorId)
        .eq("user_id", user.user.id);

      if (linkedError) throw linkedError;

      const linkedIds = new Set((linkedEvents || []).map((e) => e.event_id));
      return ((allEvents || []) as unknown as AvailableEvent[]).filter(
        (e) => !linkedIds.has(e.id)
      );
    },
    enabled: showLinkModal,
  });

  const { data: couples, isLoading: couplesLoading } = useQuery({
    queryKey: ["contact-couples-for-create"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("couples")
        .select("id, name")
        .eq("user_id", user.user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as CoupleSummary[];
    },
    enabled: showCoupleSelector,
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");
      if (!selectedEventId) throw new Error("No event selected");

      const { error } = await supabase.from("event_contacts").insert({
        event_id: selectedEventId,
        contact_id: vendorId,
        user_id: user.user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-events", vendorId] });
      queryClient.invalidateQueries({
        queryKey: ["contact-available-events", vendorId],
      });
      setShowLinkModal(false);
      setSelectedEventId(null);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventVendorId: string) => {
      const { error } = await supabase
        .from("event_contacts")
        .delete()
        .eq("id", eventVendorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-events", vendorId] });
      queryClient.invalidateQueries({
        queryKey: ["contact-available-events", vendorId],
      });
      setDeleteConfirm(null);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (eventData: Event & { vendorIds?: string[] }) => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { vendorIds, ...rest } = eventData;
      const { error } = await supabase
        .from("events")
        .update({
          date: rest.date,
          venue: rest.venue,
          price: rest.price,
          status: rest.status,
          timeline_notes: rest.timeline_notes,
        })
        .eq("id", rest.id);

      if (error) throw error;

      // Sync contacts if provided
      if (vendorIds !== undefined) {
        await supabase.from("event_contacts").delete().eq("event_id", rest.id);

        if (vendorIds.length > 0) {
          const contactLinks = vendorIds.map((id) => ({
            event_id: rest.id,
            contact_id: id,
            user_id: user.user.id,
          }));
          await supabase.from("event_contacts").insert(contactLinks);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-events", vendorId] });
      setEditingEvent(undefined);
      setEditingVendorIds([]);
    },
  });

  const handleDeleteEvent = (eventVendorId: string) => {
    setDeleteConfirm(eventVendorId);
  };

  const handleConfirmDeleteEvent = () => {
    if (deleteConfirm) {
      deleteEvent.mutate(deleteConfirm);
    }
  };

  const handleEditEvent = async (event: EventVendorRow["event"]) => {
    if (!event) return;

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    // Fetch full event data
    const { data: fullEvent, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event.id)
      .single();

    if (eventError || !fullEvent) return;

    // Fetch contact links for this event
    const { data: contactLinks } = await supabase
      .from("event_contacts")
      .select("contact_id")
      .eq("event_id", event.id)
      .eq("user_id", user.user.id);

    setEditingVendorIds(
      (contactLinks || []).map((l: { contact_id: string }) => l.contact_id)
    );
    setEditingEvent(fullEvent as Event);
  };

  const handleSaveEditEvent = async (
    eventData: Omit<Event, "id" | "user_id" | "created_at"> & {
      id?: string;
      vendorIds?: string[];
    }
  ) => {
    if (!editingEvent) return;
    await updateEvent.mutateAsync({
      ...editingEvent,
      ...eventData,
    } as Event & { vendorIds?: string[] });
  };

  const handleDeleteEditEvent = async () => {
    if (!editingEvent) return;
    // For vendor side, we only unlink the vendor from the event, not delete the event
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { error } = await supabase
      .from("event_contacts")
      .delete()
      .eq("event_id", editingEvent.id)
      .eq("contact_id", vendorId)
      .eq("user_id", user.user.id);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["contact-events", vendorId] });
      queryClient.invalidateQueries({
        queryKey: ["contact-available-events", vendorId],
      });
      setEditingEvent(undefined);
      setEditingVendorIds([]);
    }
  };

  const handleCreateEvent = async (
    eventData: Omit<Event, "id" | "user_id" | "created_at"> & {
      id?: string;
      vendorIds?: string[];
    }
  ) => {
    if (!selectedCoupleId) return;

    try {
      setCreateEventLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error("Not authenticated");

      const { vendorIds, ...rest } = eventData;
      const { data, error } = await supabase
        .from("events")
        .insert({
          ...rest,
          couple_id: selectedCoupleId,
          user_id: user.user.id,
        })
        .select();

      if (error) throw error;
      const newEvent = data?.[0] as Event;

      // Link contact to the new event and any other selected contacts
      const contactLinksToInsert = [
        {
          event_id: newEvent.id,
          contact_id: vendorId,
          user_id: user.user.id,
        },
        ...(vendorIds
          ?.filter((id) => id !== vendorId)
          .map((id) => ({
            event_id: newEvent.id,
            contact_id: id,
            user_id: user.user.id,
          })) || []),
      ];

      await supabase.from("event_contacts").insert(contactLinksToInsert);

      queryClient.invalidateQueries({ queryKey: ["contact-events", vendorId] });
      setShowEventModal(false);
      setSelectedCoupleId(null);
      setCoupleSearch("");
    } finally {
      setCreateEventLoading(false);
    }
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setSelectedCoupleId(null);
    setCoupleSearch("");
  };

  const filteredCouples = (couples || []).filter((c) =>
    c.name.toLowerCase().includes(coupleSearch.toLowerCase())
  );

  const filteredEvents = (availableEvents || []).filter((e) => {
    const searchLower = eventSearch.toLowerCase();
    return (
      (e.couple?.name || "").toLowerCase().includes(searchLower) ||
      (e.venue || "").toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {!eventVendors || eventVendors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">
              No events linked yet. Events will appear here once this contact is
              assigned to a wedding.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowLinkModal(true)}
                className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
              >
                Link Event
              </button>
              <button
                onClick={() => setShowCoupleSelector(true)}
                className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
              >
                Create Event
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {eventVendors.map((ev) => {
                const event = ev.event;
                if (!event) return null;
                const coupleName = event.couple?.name;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {coupleName || "Unknown couple"}
                      </div>
                      <div className="text-xs text-gray-500">{event.venue}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-gray-600">
                        {formatDate(event.date)}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditEvent(event)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                        >
                          <Edit2 size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          disabled={deleteEvent.isPending}
                          className="p-1 text-gray-400 hover:text-red-600 transition cursor-pointer"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLinkModal(true)}
                className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
              >
                Link Event
              </button>
              <button
                onClick={() => setShowCoupleSelector(true)}
                className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
              >
                Create Event
              </button>
            </div>
          </>
        )}
      </div>

      {/* Link Event Modal */}
      {showLinkModal && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowLinkModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 h-[600px] flex flex-col">
              <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Link Event
                </h2>
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setEventSearch("");
                    setSelectedEventId(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search couple or venue..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                {availableLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 bg-gray-100 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : !availableEvents || availableEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    All events already have this contact assigned.
                  </p>
                ) : filteredEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No events found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={`w-full text-left p-3 border rounded-xl transition cursor-pointer ${
                          selectedEventId === event.id
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {event.couple?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {event.venue}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(event.date)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {availableEvents && availableEvents.length > 0 && (
                <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex gap-2">
                  <button
                    onClick={() => {
                      setShowLinkModal(false);
                      setEventSearch("");
                      setSelectedEventId(null);
                    }}
                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addEvent.mutate()}
                    disabled={!selectedEventId || addEvent.isPending}
                    className="flex-1 px-4 py-2 text-sm bg-black text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer"
                  >
                    {addEvent.isPending ? "Adding..." : "Add"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Couple Selector Modal */}
      {showCoupleSelector && !selectedCoupleId && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowCoupleSelector(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 h-[600px] flex flex-col">
              <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Select Couple
                </h2>
                <button
                  onClick={() => {
                    setShowCoupleSelector(false);
                    setCoupleSearch("");
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search couples..."
                    value={coupleSearch}
                    onChange={(e) => setCoupleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                {couplesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 bg-gray-100 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredCouples.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {couples?.length === 0
                      ? "No couples yet"
                      : "No couples found"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredCouples.map((couple) => (
                      <button
                        key={couple.id}
                        onClick={() => setSelectedCoupleId(couple.id)}
                        className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {couple.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Event Modal */}
      {showEventModal && selectedCoupleId && (
        <EventModal
          isOpen={showEventModal}
          onClose={handleCloseEventModal}
          onSave={handleCreateEvent}
          coupleId={selectedCoupleId}
          loading={createEventLoading}
          initialVendorIds={[vendorId]}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EventModal
          isOpen={!!editingEvent}
          onClose={() => {
            setEditingEvent(undefined);
            setEditingVendorIds([]);
          }}
          onSave={handleSaveEditEvent}
          onDelete={handleDeleteEditEvent}
          event={editingEvent}
          coupleId={editingEvent.couple_id}
          loading={updateEvent.isPending}
          initialVendorIds={editingVendorIds}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[70]"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed inset-0 z-[80] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4">
              <div className="px-6 py-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Remove Event
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to remove this contact from the event?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleteEvent.isPending}
                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDeleteEvent}
                    disabled={deleteEvent.isPending}
                    className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {deleteEvent.isPending ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
