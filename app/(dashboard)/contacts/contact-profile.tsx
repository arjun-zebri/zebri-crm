"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, MoreHorizontal, Trash2 } from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import * as Popover from "@radix-ui/react-popover";
import {
  Contact,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "./contacts-types";
import { ContactOverview } from "./contact-overview";
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
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
          className="bg-white rounded-2xl shadow-xl w-full sm:max-w-2xl h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
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
                      {hasPhone && (
                        <a
                          href={`tel:${vendor.phone}`}
                          onClick={() => setActionsOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition"
                        >
                          <Phone size={14} strokeWidth={1.5} />
                          Call
                        </a>
                      )}
                      {hasEmail && (
                        <a
                          href={`mailto:${vendor.email}`}
                          onClick={() => setActionsOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition"
                        >
                          <Mail size={14} strokeWidth={1.5} />
                          Email
                        </a>
                      )}
                      {hasPhone && (
                        <a
                          href={`https://wa.me/${vendor.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setActionsOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition"
                        >
                          <PiWhatsappLogoLight size={15} />
                          WhatsApp
                        </a>
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setDeleteConfirm(true);
                            setActionsOpen(false);
                          }}
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
                {(hasPhone || hasEmail) && (
                  <>
                    <div className="w-px h-4 bg-gray-200 mx-2" />
                    <div className="flex items-center gap-0.5">
                      {hasPhone && (
                        <a
                          href={`tel:${vendor.phone}`}
                          title={`Call ${vendor.phone}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                        >
                          <Phone size={16} strokeWidth={1.5} />
                        </a>
                      )}
                      {hasEmail && (
                        <a
                          href={`mailto:${vendor.email}`}
                          title={`Email ${vendor.email}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                        >
                          <Mail size={16} strokeWidth={1.5} />
                        </a>
                      )}
                      {hasPhone && (
                        <a
                          href={`https://wa.me/${vendor.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                        >
                          <PiWhatsappLogoLight size={17} />
                        </a>
                      )}
                    </div>
                  </>
                )}
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

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
            <ContactOverview vendor={vendor} onSave={onSave} onClose={onClose} />
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
