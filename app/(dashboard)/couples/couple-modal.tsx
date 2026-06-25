"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { Couple, CoupleStatusRecord, LeadSource, LEAD_SOURCES, LEAD_SOURCE_LABELS } from '@/types/couple';

import { VenueAutocomplete, EMPTY_VENUE, type VenueDetails } from "./venue-autocomplete";

/** The first-event payload captured alongside the couple — the date and
 *  venue feed the couple's real `events` row via the page's upsert. */
export type CoupleEventInput = { date: string | null } & VenueDetails;

interface CoupleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    couple: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string },
    event: CoupleEventInput,
  ) => void;
  onDelete: (id: string) => void;
  couple?: Couple | undefined;
  statuses: CoupleStatusRecord[];
  defaultStatus?: string | undefined;
  loading: boolean;
}

export function CoupleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  couple,
  statuses,
  defaultStatus,
  loading,
}: CoupleModalProps) {
  const [name, setName] = useState("");
  const [primaryName, setPrimaryName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [status, setStatus] = useState<string>("new");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState<VenueDetails>(EMPTY_VENUE);
  const [notes, setNotes] = useState("");
  const [leadSource, setLeadSource] = useState<string>("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [leadSourceOpen, setLeadSourceOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (couple) {
      setName(couple.name);
      setPrimaryName(couple.primary_name ?? "");
      setPrimaryEmail(couple.primary_email ?? "");
      setPrimaryPhone(couple.primary_phone ?? "");
      setSecondaryName(couple.secondary_name ?? "");
      setSecondaryEmail(couple.secondary_email ?? "");
      setSecondaryPhone(couple.secondary_phone ?? "");
      setStatus(couple.status);
      // Prefill from the couple's displayed event (the real `events`
      // row), falling back to the legacy column for older records.
      setEventDate(couple.next_event_date ?? couple.event_date ?? "");
      // We only know the venue *name* on the couple row; place metadata
      // lives on the event and is re-fetched if the user reselects.
      setVenue({
        ...EMPTY_VENUE,
        venue: couple.next_event_venue ?? couple.venue ?? "",
      });
      setLeadSource(couple.lead_source || "");
      setNotes(couple.notes);
    } else {
      resetForm();
      if (defaultStatus) {
        setStatus(defaultStatus);
      }
    }
    setDeleteConfirm(false);
  }, [couple, isOpen]);

  const resetForm = () => {
    setName("");
    setPrimaryName("");
    setPrimaryEmail("");
    setPrimaryPhone("");
    setSecondaryName("");
    setSecondaryEmail("");
    setSecondaryPhone("");
    setStatus("new");
    setEventDate("");
    setVenue(EMPTY_VENUE);
    setLeadSource("");
    setNotes("");
  };

  const trim = (v: string) => (v.trim() === "" ? null : v.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !primaryName.trim()) return;

    onSave({
      id: couple?.id,
      name,
      // Legacy couple-level email/phone are kept untouched; the
      // partner triples are the canonical surface from here on.
      email: couple?.email ?? "",
      phone: couple?.phone ?? "",
      primary_name: trim(primaryName),
      primary_email: trim(primaryEmail),
      primary_phone: trim(primaryPhone),
      secondary_name: trim(secondaryName),
      secondary_email: trim(secondaryEmail),
      secondary_phone: trim(secondaryPhone),
      // The legacy `event_date` / `venue` columns are no longer the
      // source of truth; the date + venue flow into the real `events`
      // row via the page's upsert (the `event` arg below).
      event_date: eventDate || null,
      venue: couple?.venue ?? "",
      status: status as any,
      lead_source: leadSource || null,
      kanban_position: couple?.kanban_position ?? 0,
      notes,
    }, { date: eventDate || null, ...venue });
  };

  const handleDelete = () => {
    setDeleteConfirm(true);
  };

  const inputClass =
    "w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition";

  const selectedStatus = statuses.find(s => s.slug === status);
  const selectedLabel = selectedStatus?.name || "Select status";

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={couple ? "Edit Couple" : "Add Couple"}
      footer={
        <div className="flex items-center justify-between">
          {couple && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md transition cursor-pointer bg-red-50 text-red-600 hover:bg-red-100"
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !primaryName.trim()}
              className="text-xs px-3 py-1.5 rounded-md bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex flex-col gap-8">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Couple's name"
              required
            />
          </div>

          {/* Primary partner contact. The section header carries the
              required marker (no per-field label) so Primary and
              Secondary share the same visual rhythm - Save is gated
              on `primaryName` regardless. */}
          <div>
            <h4 className="block text-sm text-gray-600 mb-1">
              Primary contact <span className="text-red-500">*</span>
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                value={primaryName}
                onChange={(e) => setPrimaryName(e.target.value)}
                className={inputClass}
                placeholder="Full name"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  value={primaryEmail}
                  onChange={(e) => setPrimaryEmail(e.target.value)}
                  className={inputClass}
                  placeholder="Email"
                />
                <input
                  type="tel"
                  value={primaryPhone}
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                  className={inputClass}
                  placeholder="Phone"
                />
              </div>
            </div>
          </div>

          {/* Secondary partner - same shape. Both can be empty if
              the MC hasn't captured the partner details yet. */}
          <div>
            <h4 className="block text-sm text-gray-600 mb-1">
              Secondary contact
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                className={inputClass}
                placeholder="Full name"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  className={inputClass}
                  placeholder="Email"
                />
                <input
                  type="tel"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  className={inputClass}
                  placeholder="Phone"
                />
              </div>
            </div>
          </div>

          {/* Wedding date + venue. Optional — when set, the page creates
              the couple's first event (or updates its soonest), since the
              schedule lives in the `events` table, not on the couple. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Wedding date
              </label>
              <DatePicker
                value={eventDate}
                onChange={setEventDate}
                variant="underline"
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Venue
              </label>
              <VenueAutocomplete
                value={venue}
                onChange={setVenue}
                inputClassName={inputClass}
                showDetails={false}
              />
            </div>
          </div>

          {/* Status + Lead Source share a row on sm+ - both are
              compact picklists, stacking them makes the modal feel
              taller than it needs to. Whitespace separates them
              from the Secondary contact block above. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Status
            </label>
            <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left`}
                >
                  <span
                    className={
                      selectedLabel ? "text-gray-900" : "text-gray-400"
                    }
                  >
                    {selectedLabel || "Select status"}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                  align="start"
                >
                  {statuses.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => {
                        setStatus(s.slug);
                        setStatusOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        status === s.slug
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Lead Source
            </label>
            <Popover.Root open={leadSourceOpen} onOpenChange={setLeadSourceOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left`}
                >
                  <span
                    className={
                      leadSource ? "text-gray-900" : "text-gray-400"
                    }
                  >
                    {leadSource ? LEAD_SOURCE_LABELS[leadSource as LeadSource] : "Select source"}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
                  align="start"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSource("");
                      setLeadSourceOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      !leadSource
                        ? "bg-green-50 text-green-700"
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
                        setLeadSourceOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        leadSource === s
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {LEAD_SOURCE_LABELS[s]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            placeholder="Any additional notes..."
            rows={8}
          />
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      open={deleteConfirm}
      title="Delete Couple"
      description="Are you sure you want to delete this couple? This cannot be undone."
      onConfirm={() => {
        if (couple) onDelete(couple.id);
      }}
      onCancel={() => setDeleteConfirm(false)}
      loading={loading}
    />
    </>
  );
}
