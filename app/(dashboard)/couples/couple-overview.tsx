"use client";

import { useState, useCallback } from "react";
import { Pencil } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import {
  Couple,
  LEAD_SOURCE_LABELS,
  LeadSource,
  LEAD_SOURCES,
} from "./couples-types";
import { CoupleEvents } from "./couple-events";
import { CoupleVendors } from "./couple-vendors";

interface CoupleOverviewProps {
  couple: Couple;
  onSave: (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
}

export function CoupleOverview({ couple, onSave }: CoupleOverviewProps) {
  const [editingField, setEditingField] = useState<
    "phone" | "email" | "leadSource" | "notes" | null
  >(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const isLoading = eventsLoading || contactsLoading;
  const handleEventsLoading = useCallback((v: boolean) => setEventsLoading(v), []);
  const handleContactsLoading = useCallback((v: boolean) => setContactsLoading(v), []);
  const [phone, setPhone] = useState(couple.phone);
  const [email, setEmail] = useState(couple.email);
  const [leadSource, setLeadSource] = useState(couple.lead_source || "");
  const [notes, setNotes] = useState(couple.notes ?? "");
  const [leadSourceOpen, setLeadSourceOpen] = useState(false);

  const leadSourceLabel = leadSource
    ? LEAD_SOURCE_LABELS[leadSource as LeadSource] ?? leadSource
    : null;

  const handleSaveField = (field: string, value: string | null) => {
    setEditingField(null);
    onSave({
      id: couple.id,
      name: couple.name,
      email: field === "email" ? (value ?? "") : email,
      phone: field === "phone" ? (value ?? "") : phone,
      status: couple.status,
      lead_source: field === "leadSource" ? value : leadSource || null,
      kanban_position: couple.kanban_position,
      notes: field === "notes" ? (value ?? "") : notes,
      event_date: couple.event_date,
      venue: couple.venue,
    });
  };

  return (
    <>
      {/* Skeleton — shown while events or contacts are loading */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-pulse">
          <div className="space-y-4">
            <div className="h-3 w-16 bg-gray-100 rounded-full" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="h-3 w-20 bg-gray-100 rounded-full" />
                <div className="h-3 w-32 bg-gray-100 rounded-full" />
              </div>
            ))}
            <div className="h-16 bg-gray-100 rounded-xl mt-2" />
          </div>
          <div className="space-y-8">
            <div>
              <div className="h-3 w-16 bg-gray-100 rounded-full mb-4" />
              {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl mb-2" />)}
            </div>
            <div>
              <div className="h-3 w-20 bg-gray-100 rounded-full mb-4" />
              {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl mb-2" />)}
            </div>
          </div>
        </div>
      )}

      {/* Real content — always mounted so queries fire; hidden via CSS while loading */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 ${isLoading ? 'hidden' : ''}`}>
      {/* Column 1: General Info */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">General</h3>

        {/* Phone */}
        <div className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2">
          <span className="text-sm text-gray-700 w-28 shrink-0">Phone</span>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={() => setEditingField("phone")}
              onBlur={() => handleSaveField("phone", phone)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="+61 400 000 000"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${editingField === "phone" ? "opacity-0" : "opacity-0 group-hover:opacity-60"}`}
            />
          </div>
        </div>

        {/* Email */}
        <div className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2">
          <span className="text-sm text-gray-700 w-28 shrink-0">Email</span>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEditingField("email")}
              onBlur={() => handleSaveField("email", email)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="email@example.com"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${editingField === "email" ? "opacity-0" : "opacity-0 group-hover:opacity-60"}`}
            />
          </div>
        </div>

        {/* Lead Source */}
        <div
          className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2 cursor-pointer"
          onClick={() => {
            if (editingField !== "leadSource") {
              setEditingField("leadSource");
              setLeadSourceOpen(true);
            }
          }}
        >
          <span className="text-sm text-gray-700 w-28 shrink-0">
            Lead source
          </span>
          {editingField === "leadSource" ? (
            <Popover.Root
              open={leadSourceOpen}
              onOpenChange={(open) => {
                setLeadSourceOpen(open);
                if (!open) setEditingField(null);
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-end gap-1 text-sm bg-transparent outline-none border-none cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={leadSource ? "text-gray-900" : "text-gray-400"}>
                    {leadSource
                      ? LEAD_SOURCE_LABELS[leadSource as LeadSource]
                      : "Select source"}
                  </span>
                  <Pencil size={11} className="opacity-60 shrink-0 text-gray-500" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-48"
                  sideOffset={4}
                  align="end"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSource("");
                      handleSaveField("leadSource", null);
                      setLeadSourceOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      !leadSource
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    None
                  </button>
                  {LEAD_SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setLeadSource(s);
                        handleSaveField("leadSource", s);
                        setLeadSourceOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        leadSource === s
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {LEAD_SOURCE_LABELS[s]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
              {leadSourceLabel ? (
                <span className="text-sm text-gray-500">{leadSourceLabel}</span>
              ) : (
                <span className="text-sm text-gray-300">—</span>
              )}
              <Pencil
                size={11}
                className="opacity-0 group-hover:opacity-60 shrink-0 text-gray-400"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="group py-3 rounded-xl -mx-2 px-2">
          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-700 w-28 shrink-0 pt-0.5">Notes</span>
            <Pencil
              size={11}
              className={`shrink-0 mt-1 text-gray-500 transition ${editingField === "notes" ? "opacity-0" : "opacity-0 group-hover:opacity-60"}`}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => setEditingField("notes")}
            onBlur={() => handleSaveField("notes", notes)}
            placeholder="Any additional notes..."
            rows={editingField === "notes" ? 4 : undefined}
            className="w-full bg-transparent outline-none border-none resize-none mt-1 text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text leading-relaxed"
          />
        </div>
      </div>

      {/* Column 2: Events & Contacts */}
      <div className="space-y-8">
        <div>
          <CoupleEvents couple={couple} onLoadingChange={handleEventsLoading} />
        </div>

        <div>
          <CoupleVendors coupleId={couple.id} onLoadingChange={handleContactsLoading} />
        </div>
      </div>
    </div>
  </>
  );
}
