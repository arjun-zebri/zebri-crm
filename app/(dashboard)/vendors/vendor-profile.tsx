"use client";

import { useState } from "react";
import { X, Phone, Mail, Pencil } from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import { Vendor, CATEGORY_LABELS, STATUS_LABELS } from "./vendors-types";
import { Badge } from "@/components/ui/badge";
import { VendorOverview } from "./vendor-overview";
import { VendorEvents } from "./vendor-events";

interface VendorProfileProps {
  vendor: Vendor | null;
  onClose: () => void;
  onEdit: (vendor: Vendor) => void;
}

export function VendorProfile({ vendor, onClose, onEdit }: VendorProfileProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "events">("overview");

  if (!vendor) return null;

  const hasPhone = !!vendor.phone;
  const hasEmail = !!vendor.email;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[640px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 px-4 md:px-8 pt-5 md:pt-6 pb-4 md:pb-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-semibold text-gray-900 truncate">
                  {vendor.name}
                </h1>
                <Badge variant={vendor.category as any}>
                  {CATEGORY_LABELS[vendor.category]}
                </Badge>
              </div>
              {vendor.contact_name && (
                <p className="text-sm text-gray-500">{vendor.contact_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-5">
            <div
              className={`w-2 h-2 rounded-xl ${
                vendor.status === "active" ? "bg-emerald-400" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-600">
              {STATUS_LABELS[vendor.status]}
            </span>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2">
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
              <span className="hidden sm:inline">Call</span>
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
              <span className="hidden sm:inline">Email</span>
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
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <button
              onClick={() => onEdit(vendor)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer ml-auto"
            >
              <Pencil size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-t border-b border-gray-200 px-4 md:px-8">
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

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6">
          {activeTab === "overview" && (
            <VendorOverview
              vendor={vendor}
              onEditClick={() => onEdit(vendor)}
            />
          )}
          {activeTab === "events" && <VendorEvents vendorId={vendor.id} />}
        </div>
      </div>
    </>
  );
}
