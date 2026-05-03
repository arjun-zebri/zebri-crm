"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

interface ContactUsedByProps {
  contactId: string;
  onClose?: () => void;
}

interface CoupleLinkRow {
  couple: { id: string; name: string } | null;
}

interface EventLinkRow {
  event: {
    id: string;
    date: string | null;
    venue: string | null;
    couple: { id: string; name: string } | null;
  } | null;
}

interface CoupleSummary {
  id: string;
  name: string;
  events: { id: string; date: string | null; venue: string | null }[];
  source: "couple" | "event-only";
}

export function ContactUsedBy({ contactId, onClose }: ContactUsedByProps) {
  const supabase = createClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["contact-used-by", contactId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const [coupleLinks, eventLinks] = await Promise.all([
        supabase
          .from("couple_contacts")
          .select("couple:couple_id(id, name)")
          .eq("contact_id", contactId)
          .eq("user_id", user.user.id),
        supabase
          .from("event_contacts")
          .select("event:event_id(id, date, venue, couple:couple_id(id, name))")
          .eq("contact_id", contactId)
          .eq("user_id", user.user.id),
      ]);

      if (coupleLinks.error) throw coupleLinks.error;
      if (eventLinks.error) throw eventLinks.error;

      const couplesById = new Map<string, CoupleSummary>();

      for (const row of (coupleLinks.data ?? []) as unknown as CoupleLinkRow[]) {
        if (!row.couple) continue;
        couplesById.set(row.couple.id, {
          id: row.couple.id,
          name: row.couple.name,
          events: [],
          source: "couple",
        });
      }

      for (const row of (eventLinks.data ?? []) as unknown as EventLinkRow[]) {
        const event = row.event;
        if (!event?.couple) continue;
        const existing = couplesById.get(event.couple.id);
        const eventEntry = { id: event.id, date: event.date, venue: event.venue };
        if (existing) {
          existing.events.push(eventEntry);
        } else {
          couplesById.set(event.couple.id, {
            id: event.couple.id,
            name: event.couple.name,
            events: [eventEntry],
            source: "event-only",
          });
        }
      }

      const couples = Array.from(couplesById.values()).sort((a, b) => {
        const nextA = nextEventDate(a.events);
        const nextB = nextEventDate(b.events);
        if (nextA && nextB) return nextA.localeCompare(nextB);
        if (nextA) return -1;
        if (nextB) return 1;
        return a.name.localeCompare(b.name);
      });

      const totalEvents = couples.reduce((sum, c) => sum + c.events.length, 0);

      return { couples, totalEvents };
    },
  });

  const handleOpenCouple = (coupleId: string) => {
    onClose?.();
    router.push(`/couples?openCouple=${coupleId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-16 bg-gray-100 rounded-full mb-3 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const couples = data?.couples ?? [];
  const totalEvents = data?.totalEvents ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
          Used by
        </h3>
        {couples.length > 0 && (
          <span className="text-xs text-gray-400">
            {couples.length} {couples.length === 1 ? "couple" : "couples"}
            {totalEvents > 0 && ` · ${totalEvents} ${totalEvents === 1 ? "event" : "events"}`}
          </span>
        )}
      </div>

      {couples.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl px-4 py-8 text-center">
          <Users size={20} strokeWidth={1.5} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Not linked to any couples yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Add this contact from a couple&apos;s profile to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {couples.map((couple) => {
            const next = couple.events.find((e) => e.date) || couple.events[0];
            return (
              <button
                key={couple.id}
                onClick={() => handleOpenCouple(couple.id)}
                className="group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {couple.name}
                  </div>
                  {next && (next.date || next.venue) ? (
                    <div className="text-xs text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                      <Calendar size={11} strokeWidth={1.5} />
                      <span>
                        {next.date ? formatDate(next.date) : "Date TBC"}
                        {next.venue ? ` · ${next.venue}` : ""}
                        {couple.events.length > 1 && ` · +${couple.events.length - 1} more`}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {couple.source === "couple" ? "No event yet" : ""}
                    </div>
                  )}
                </div>
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="text-gray-300 shrink-0 group-hover:text-gray-500 transition"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function nextEventDate(events: { date: string | null }[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const future = events
    .map((e) => e.date)
    .filter((d): d is string => !!d && d >= today)
    .sort();
  if (future.length > 0) return future[0];
  const past = events
    .map((e) => e.date)
    .filter((d): d is string => !!d)
    .sort()
    .reverse();
  return past[0] ?? null;
}
