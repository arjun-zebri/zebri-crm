"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Vendor,
  VendorCategory,
  VendorStatus,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "./vendors-types";

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    vendor: Omit<Vendor, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onDelete: (id: string) => void;
  vendor?: Vendor;
  loading: boolean;
}

export function VendorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  vendor,
  loading,
}: VendorModalProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<VendorCategory>("other");
  const [status, setStatus] = useState<VendorStatus>("active");
  const [notes, setNotes] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setContactName(vendor.contact_name);
      setPhone(vendor.phone);
      setEmail(vendor.email);
      setCategory(vendor.category);
      setStatus(vendor.status);
      setNotes(vendor.notes);
    } else {
      resetForm();
    }
    setDeleteConfirm(false);
  }, [vendor, isOpen]);

  const resetForm = () => {
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setCategory("other");
    setStatus("active");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: vendor?.id,
      name,
      contact_name: contactName,
      phone,
      email,
      category,
      status,
      notes,
    });

    resetForm();
  };

  const handleDelete = () => {
    setDeleteConfirm(true);
  };

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition";

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vendor ? "Edit Vendor" : "Add Vendor"}
      footer={
        <div className="flex items-center justify-between">
          {vendor && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-xl transition cursor-pointer bg-red-50 text-red-600 hover:bg-red-100"
            >
              Delete
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Vendor Name - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor / Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Elegant Venues"
              className={inputClass}
              required
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <Popover.Root open={categoryOpen} onOpenChange={setCategoryOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={inputClass + " flex items-center justify-between"}
                >
                  {CATEGORY_LABELS[category]}
                  <ChevronDown size={16} className="text-gray-400" strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className="z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
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
                        ? "bg-green-50 text-green-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Root>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={inputClass + " flex items-center justify-between"}
                >
                  {STATUS_LABELS[status]}
                  <ChevronDown size={16} className="text-gray-400" strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Content
                className="z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
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
                        ? "bg-green-50 text-green-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {STATUS_LABELS[stat]}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Root>
          </div>

          {/* Notes - 2 cols */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Working notes, preferences, things to remember..."
              rows={8}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      open={deleteConfirm}
      title="Delete Vendor"
      description="Are you sure you want to delete this vendor? This cannot be undone."
      onConfirm={() => {
        if (vendor) onDelete(vendor.id);
      }}
      onCancel={() => setDeleteConfirm(false)}
      loading={loading}
    />
    </>
  );
}
