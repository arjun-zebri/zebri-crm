"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, Pencil, ChevronDown } from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import * as Popover from "@radix-ui/react-popover";
import {
  Couple,
  LeadSource,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  getStatusClasses,
} from "./couples-types";
import { useCoupleStatuses } from "./use-couple-statuses";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoupleOverview } from "./couple-overview";
import { CoupleEvents } from "./couple-events";
import { CoupleVendors } from "./couple-vendors";
import { CoupleTasks } from "./couple-tasks";

interface CoupleProfileProps {
  couple: Couple | null;
  onClose: () => void;
  onSave: (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onDelete: (id: string) => void;
  loading: boolean;
  defaultTab?: "overview" | "events" | "contacts" | "tasks";
}

export function CoupleProfile({
  couple,
  onClose,
  onSave,
  onDelete,
  loading,
  defaultTab = "overview",
}: CoupleProfileProps) {
  const { data: statuses } = useCoupleStatuses();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [activeTab, setActiveTab] = useState<
    "overview" | "events" | "contacts" | "tasks"
  >(defaultTab);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [notes, setNotes] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [leadSourceOpen, setLeadSourceOpen] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (couple) {
      setName(couple.name);
      setEmail(couple.email);
      setPhone(couple.phone);
      setStatus(couple.status);
      setLeadSource(couple.lead_source || "");
      setNotes(couple.notes);
    }
    setMode("view");
    setActiveTab(defaultTab);
    setDeleteConfirm(false);
  }, [couple]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (couple) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }
  }, [couple, onClose]);

  if (!couple) return null;

  const hasPhone = !!couple.phone;
  const hasEmail = !!couple.email;
  const initials = couple.name.charAt(0).toUpperCase();
  const currentStatus = statuses.find((s) => s.slug === couple.status);
  const statusName =
    currentStatus?.name ||
    couple.status.charAt(0).toUpperCase() + couple.status.slice(1);
  const statusClasses = currentStatus
    ? getStatusClasses(currentStatus.color)
    : getStatusClasses("gray");

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition";

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: couple.id,
      name,
      email,
      phone,
      status,
      lead_source: leadSource || null,
      notes,
      event_date: couple.event_date,
      venue: couple.venue,
    });
  };

  const handleCancel = () => {
    setName(couple.name);
    setEmail(couple.email);
    setPhone(couple.phone);
    setStatus(couple.status);
    setLeadSource(couple.lead_source || "");
    setNotes(couple.notes);
    setMode("view");
  };

  const selectedStatus = statuses.find((s) => s.slug === status);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          data-testid="couple-profile-panel"
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[640px] max-h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center gap-4">
              {/* Initials avatar */}
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="text-base font-semibold text-gray-500">
                  {initials}
                </span>
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 truncate">
                  {couple.name}
                </h2>
                {mode === "view" && (
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses.pill}`}
                    >
                      {statusName}
                    </span>
                  </div>
                )}
              </div>

              {/* Edit + close */}
              <div className="flex items-center gap-0.5 shrink-0">
                {mode === "view" && (
                  <button
                    onClick={() => setMode("edit")}
                    title="Edit couple"
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  >
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Action buttons — view mode only */}
            {mode === "view" && (
              <div className="flex items-center gap-2 mt-4">
                <a
                  href={hasPhone ? `tel:${couple.phone}` : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-xl transition ${
                    hasPhone
                      ? "text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer"
                      : "text-gray-300 border-gray-100 cursor-not-allowed"
                  }`}
                  onClick={hasPhone ? undefined : (e) => e.preventDefault()}
                >
                  <Phone size={14} strokeWidth={1.5} />
                  <span>Call</span>
                </a>
                <a
                  href={hasEmail ? `mailto:${couple.email}` : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-xl transition ${
                    hasEmail
                      ? "text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer"
                      : "text-gray-300 border-gray-100 cursor-not-allowed"
                  }`}
                  onClick={hasEmail ? undefined : (e) => e.preventDefault()}
                >
                  <Mail size={14} strokeWidth={1.5} />
                  <span>Email</span>
                </a>
                <a
                  href={
                    hasPhone
                      ? `https://wa.me/${couple.phone.replace(/\D/g, "")}`
                      : undefined
                  }
                  target={hasPhone ? "_blank" : undefined}
                  rel={hasPhone ? "noopener noreferrer" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-xl transition ${
                    hasPhone
                      ? "text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer"
                      : "text-gray-300 border-gray-100 cursor-not-allowed"
                  }`}
                  onClick={hasPhone ? undefined : (e) => e.preventDefault()}
                >
                  <PiWhatsappLogoLight size={16} />
                  <span>WhatsApp</span>
                </a>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-t border-b border-gray-100 px-6">
            <div className="flex gap-6">
              {(
                [
                  { key: "overview", label: "Overview" },
                  { key: "events", label: "Events" },
                  { key: "contacts", label: "Contacts" },
                  { key: "tasks", label: "Tasks" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                    activeTab === key
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col">
            {activeTab === "overview" && mode === "view" && (
              <div className="flex-1 flex flex-col min-h-0">
                <CoupleOverview
                  couple={couple}
                  statuses={statuses}
                />
              </div>
            )}

            {activeTab === "overview" && mode === "edit" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Couple's name"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 400 000 000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Status
                  </label>
                  <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={`${inputClass} flex items-center justify-between text-left`}
                      >
                        <span>{selectedStatus?.name || "Select status"}</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.5}
                          className="text-gray-400 shrink-0"
                        />
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
                                ? "bg-gray-100 text-gray-900 font-medium"
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
                  <label className="block text-sm text-gray-400 mb-1">
                    Lead Source
                  </label>
                  <Popover.Root
                    open={leadSourceOpen}
                    onOpenChange={setLeadSourceOpen}
                  >
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={`${inputClass} flex items-center justify-between text-left`}
                      >
                        <span
                          className={leadSource ? "text-gray-900" : "text-gray-400"}
                        >
                          {leadSource
                            ? LEAD_SOURCE_LABELS[leadSource as LeadSource]
                            : "Select source"}
                        </span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.5}
                          className="text-gray-400 shrink-0"
                        />
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
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={7}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            )}

            {activeTab === "events" && <CoupleEvents couple={couple} />}
            {activeTab === "contacts" && <CoupleVendors coupleId={couple.id} />}
            {activeTab === "tasks" && <CoupleTasks coupleId={couple.id} />}
          </div>

          {/* Footer — edit mode only */}
          {mode === "edit" && (
            <div className="shrink-0 border-t border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setDeleteConfirm(true)}
                  disabled={loading}
                  className="text-sm px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || !name.trim()}
                    className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
