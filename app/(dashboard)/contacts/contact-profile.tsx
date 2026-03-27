"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, Pencil, ChevronDown } from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import * as Popover from "@radix-ui/react-popover";
import {
  Contact,
  ContactCategory,
  ContactStatus,
  CATEGORY_LABELS,
  STATUS_LABELS,
  CATEGORIES,
  STATUSES,
} from "./contacts-types";
import { Badge } from "@/components/ui/badge";
import { ContactOverview } from "./contact-overview";
import { ContactEvents } from "./contact-events";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ContactProfileProps {
  vendor: Contact | null;
  onClose: () => void;
  onSave: (
    data: Omit<Contact, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export function ContactProfile({
  vendor,
  onClose,
  onSave,
  onDelete,
  loading,
}: ContactProfileProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [activeTab, setActiveTab] = useState<"overview" | "events">("overview");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<ContactCategory>("other");
  const [status, setStatus] = useState<ContactStatus>("active");
  const [notes, setNotes] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setContactName(vendor.contact_name);
      setPhone(vendor.phone);
      setEmail(vendor.email);
      setCategory(vendor.category);
      setStatus(vendor.status);
      setNotes(vendor.notes);
    }
    setMode("view");
    setActiveTab("overview");
    setDeleteConfirm(false);
  }, [vendor]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (vendor) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }
  }, [vendor, onClose]);

  if (!vendor) return null;

  const hasPhone = !!vendor.phone;
  const hasEmail = !!vendor.email;
  const initials = vendor.name.charAt(0).toUpperCase();

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition";

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: vendor.id,
      name,
      contact_name: contactName,
      phone,
      email,
      category,
      status,
      notes,
    });
  };

  const handleCancel = () => {
    setName(vendor.name);
    setContactName(vendor.contact_name);
    setPhone(vendor.phone);
    setEmail(vendor.email);
    setCategory(vendor.category);
    setStatus(vendor.status);
    setNotes(vendor.notes);
    setMode("view");
  };

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
          data-testid="contact-profile-panel"
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[640px] max-h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center gap-4">
              {/* Initials avatar */}
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-semibold text-gray-500">
                  {initials}
                </span>
              </div>

              {/* Name + badge + status */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 truncate">
                  {vendor.name}
                </h2>
                {mode === "view" && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={vendor.category as any}>
                      {CATEGORY_LABELS[vendor.category]}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          vendor.status === "active"
                            ? "bg-emerald-400"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-400">
                        {STATUS_LABELS[vendor.status]}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Edit + close */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {mode === "view" && (
                  <button
                    onClick={() => setMode("edit")}
                    title="Edit contact"
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
                  href={hasPhone ? `tel:${vendor.phone}` : undefined}
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
                  href={hasEmail ? `mailto:${vendor.email}` : undefined}
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
                      ? `https://wa.me/${vendor.phone.replace(/\D/g, "")}`
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
          <div className="flex-shrink-0 border-t border-b border-gray-100 px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                  activeTab === "overview"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                  activeTab === "events"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Events
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col">
            {activeTab === "overview" && mode === "view" && (
              <div className="flex-1 flex flex-col min-h-0">
                <ContactOverview
                  vendor={vendor}
                  onEditClick={() => setMode("edit")}
                />
              </div>
            )}

            {activeTab === "overview" && mode === "edit" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Contact / Business Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Elegant Venues"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g., John Smith"
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
                    placeholder="+1 (555) 000-0000"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Category
                  </label>
                  <Popover.Root
                    open={categoryOpen}
                    onOpenChange={setCategoryOpen}
                  >
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={`${inputClass} flex items-center justify-between`}
                      >
                        {CATEGORY_LABELS[category]}
                        <ChevronDown
                          size={16}
                          className="text-gray-400"
                          strokeWidth={1.5}
                        />
                      </button>
                    </Popover.Trigger>
                    <Popover.Content
                      className="z-[70] w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
                      side="bottom"
                      align="start"
                    >
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setCategoryOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition ${
                            category === cat
                              ? "bg-gray-100 text-gray-900 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {CATEGORY_LABELS[cat]}
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Root>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Status
                  </label>
                  <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={`${inputClass} flex items-center justify-between`}
                      >
                        {STATUS_LABELS[status]}
                        <ChevronDown
                          size={16}
                          className="text-gray-400"
                          strokeWidth={1.5}
                        />
                      </button>
                    </Popover.Trigger>
                    <Popover.Content
                      className="z-[70] w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
                      side="bottom"
                      align="start"
                    >
                      {STATUSES.map((stat) => (
                        <button
                          key={stat}
                          type="button"
                          onClick={() => {
                            setStatus(stat);
                            setStatusOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition ${
                            status === stat
                              ? "bg-gray-100 text-gray-900 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {STATUS_LABELS[stat]}
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Root>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Working notes, preferences, things to remember..."
                    rows={7}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            )}

            {activeTab === "events" && <ContactEvents vendorId={vendor.id} />}
          </div>

          {/* Footer — edit mode only */}
          {mode === "edit" && (
            <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4">
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
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This cannot be undone."
        onConfirm={() => {
          if (vendor) onDelete(vendor.id);
        }}
        onCancel={() => setDeleteConfirm(false)}
        loading={loading}
      />
    </>
  );
}
