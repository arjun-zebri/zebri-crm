"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Phone, Mail, Trash2 } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Contact,
  ContactCategory,
  ContactStatus,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "./contacts-types";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    contact: Omit<Contact, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onDelete: (id: string) => void;
  vendor?: Contact;
  loading: boolean;
  nested?: boolean;
}

export function ContactModal({
  isOpen,
  onClose,
  nested,
  onSave,
  onDelete,
  vendor,
  loading,
}: ContactModalProps) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<ContactCategory>("other");
  const [status, setStatus] = useState<ContactStatus>("active");
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
    "w-full border-0 border-b border-gray-200 bg-transparent px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 transition";

  const headerActions = vendor ? (
    <>
      {vendor.phone && (
        <a
          href={`tel:${vendor.phone}`}
          className="p-1.5 text-gray-400 hover:text-gray-700 transition"
          title={vendor.phone}
        >
          <Phone size={16} strokeWidth={1.5} />
        </a>
      )}
      {vendor.email && (
        <a
          href={`mailto:${vendor.email}`}
          className="p-1.5 text-gray-400 hover:text-gray-700 transition"
          title={vendor.email}
        >
          <Mail size={16} strokeWidth={1.5} />
        </a>
      )}
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-1.5 text-gray-400 hover:text-red-500 transition disabled:opacity-50 cursor-pointer"
        title="Delete contact"
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </>
  ) : undefined

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vendor ? vendor.name : "Add Contact"}
      headerActions={headerActions}
      nested={nested}
      footer={
        <div className="flex items-center justify-end gap-3">
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
      }
    >

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Contact / Business Name <span className="text-red-500">*</span>
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

          <div>
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

          {/* Category */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Category
            </label>
            <Popover.Root open={categoryOpen} onOpenChange={setCategoryOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={`${inputClass} flex items-center justify-between text-left`}
                >
                  {CATEGORY_LABELS[category]}
                  <ChevronDown size={14} className="text-gray-400 shrink-0" strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
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
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        category === cat
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Status */}
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
                  {STATUS_LABELS[status]}
                  <ChevronDown size={14} className="text-gray-400 shrink-0" strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)]"
                  sideOffset={4}
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
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        status === stat
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {STATUS_LABELS[stat]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
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
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
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
      </form>
    </Modal>

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
