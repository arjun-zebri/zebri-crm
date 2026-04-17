"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, MoreHorizontal, Trash2, LayoutDashboard, Calendar } from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import * as Popover from "@radix-ui/react-popover";
import {
  Contact,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "./contacts-types";
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
  const [activeTab, setActiveTab] = useState<"overview" | "events">("overview");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <div
          data-testid="contact-profile-panel"
          className="bg-white rounded-2xl shadow-xl w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact header */}
          <div className="shrink-0 border-b border-gray-200 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Name + pills */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {vendor.name}
                </h2>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {CATEGORY_LABELS[vendor.category]}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      vendor.status === "active" ? "bg-emerald-400" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-xs text-gray-400">
                    {STATUS_LABELS[vendor.status]}
                  </span>
                </div>
              </div>

              {/* Actions + close — mobile only */}
              <div className="sm:hidden flex items-center gap-1.5">
                <Popover.Root open={actionsOpen} onOpenChange={setActionsOpen}>
                  <Popover.Trigger asChild>
                    <button
                      title="Actions"
                      className="shrink-0 p-1.5 ring-1 ring-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                    >
                      <MoreHorizontal size={16} strokeWidth={1.5} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="bg-white border border-gray-200 rounded-xl shadow-lg z-[70] w-44 py-1.5"
                      sideOffset={6}
                      align="end"
                    >
                      <a
                        href={hasPhone ? `tel:${vendor.phone}` : undefined}
                        onClick={(e) => { if (!hasPhone) e.preventDefault(); else setActionsOpen(false); }}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasPhone ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                      >
                        <Phone size={14} strokeWidth={1.5} />
                        Call
                      </a>
                      <a
                        href={hasEmail ? `mailto:${vendor.email}` : undefined}
                        onClick={(e) => { if (!hasEmail) e.preventDefault(); else setActionsOpen(false); }}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasEmail ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                      >
                        <Mail size={14} strokeWidth={1.5} />
                        Email
                      </a>
                      <a
                        href={hasPhone ? `https://wa.me/${vendor.phone.replace(/\D/g, "")}` : undefined}
                        target={hasPhone ? "_blank" : undefined}
                        rel={hasPhone ? "noopener noreferrer" : undefined}
                        onClick={(e) => { if (!hasPhone) e.preventDefault(); else setActionsOpen(false); }}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasPhone ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                      >
                        <PiWhatsappLogoLight size={15} />
                        WhatsApp
                      </a>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => { setDeleteConfirm(true); setActionsOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                          Delete contact
                        </button>
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              {/* Desktop: all controls in one row */}
              <div className="hidden sm:flex items-center">
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-2" />
                <div className="flex items-center gap-0.5">
                  <a
                    href={hasPhone ? `tel:${vendor.phone}` : undefined}
                    className={`p-1.5 rounded-lg transition ${hasPhone ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" : "text-gray-200 cursor-not-allowed pointer-events-none"}`}
                  >
                    <Phone size={16} strokeWidth={1.5} />
                  </a>
                  <a
                    href={hasEmail ? `mailto:${vendor.email}` : undefined}
                    className={`p-1.5 rounded-lg transition ${hasEmail ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" : "text-gray-200 cursor-not-allowed pointer-events-none"}`}
                  >
                    <Mail size={16} strokeWidth={1.5} />
                  </a>
                  <a
                    href={hasPhone ? `https://wa.me/${vendor.phone.replace(/\D/g, "")}` : undefined}
                    target={hasPhone ? "_blank" : undefined}
                    rel={hasPhone ? "noopener noreferrer" : undefined}
                    className={`p-1.5 rounded-lg transition ${hasPhone ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" : "text-gray-200 cursor-not-allowed pointer-events-none"}`}
                  >
                    <PiWhatsappLogoLight size={17} />
                  </a>
                </div>
                <div className="w-px h-4 bg-gray-200 mx-2" />
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Body: Nav + Content */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            {/* Mobile: horizontal scrollable pill tabs */}
            <div className="sm:hidden shrink-0 border-b border-gray-200 overflow-x-auto">
              <div className="flex px-2 py-2 gap-1 min-w-max">
                {[
                  { key: "overview" as const, label: "Overview", icon: <LayoutDashboard size={14} strokeWidth={1.5} /> },
                  { key: "events" as const, label: "Events", icon: <Calendar size={14} strokeWidth={1.5} /> },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                      activeTab === item.key
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: sidebar navigation */}
            <nav className="hidden sm:block w-[200px] shrink-0 border-r border-gray-200 overflow-y-auto px-3 py-4 space-y-0.5">
              {[
                { key: "overview" as const, label: "Overview", icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
                { key: "events" as const, label: "Events", icon: <Calendar size={18} strokeWidth={1.5} /> },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
                    activeTab === item.key
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Content area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col">
              {activeTab === "overview" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ContactOverview vendor={vendor} onSave={onSave} />
                </div>
              )}
              {activeTab === "events" && <ContactEvents vendorId={vendor.id} />}
            </div>
          </div>
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
