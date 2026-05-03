"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Contact } from "./contacts-types";
import { ContactUsedBy } from "./contact-used-by";

interface ContactOverviewProps {
  vendor: Contact;
  onSave: (
    data: Omit<Contact, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onClose?: () => void;
}

export function ContactOverview({ vendor, onSave, onClose }: ContactOverviewProps) {
  const [editingField, setEditingField] = useState<
    "name" | "contact_name" | "phone" | "email" | "notes" | null
  >(null);
  const [name, setName] = useState(vendor.name);
  const [contactName, setContactName] = useState(vendor.contact_name ?? "");
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [email, setEmail] = useState(vendor.email ?? "");
  const [notes, setNotes] = useState(vendor.notes ?? "");

  useEffect(() => {
    setName(vendor.name);
    setContactName(vendor.contact_name ?? "");
    setPhone(vendor.phone ?? "");
    setEmail(vendor.email ?? "");
    setNotes(vendor.notes ?? "");
  }, [vendor]);

  const save = (
    patch: Partial<
      Pick<Contact, "name" | "contact_name" | "phone" | "email" | "notes">
    >
  ) => {
    onSave({
      id: vendor.id,
      name,
      contact_name: contactName,
      phone,
      email,
      category: vendor.category,
      status: vendor.status,
      notes,
      ...patch,
    });
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Section 1: General */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">
          General
        </h3>

        {/* Name */}
        <div className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2">
          <span className="text-sm text-gray-700 w-28 shrink-0">Name</span>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setEditingField("name")}
              onBlur={(e) => {
                setEditingField(null);
                if (e.target.value.trim()) save({ name: e.target.value });
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              placeholder="Contact name"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${
                editingField === "name"
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-60"
              }`}
            />
          </div>
        </div>

        {/* Contact person */}
        <div className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2">
          <span className="text-sm text-gray-700 w-28 shrink-0">
            Contact person
          </span>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              onFocus={() => setEditingField("contact_name")}
              onBlur={(e) => {
                setEditingField(null);
                save({ contact_name: e.target.value });
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              placeholder="e.g., John Smith"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${
                editingField === "contact_name"
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-60"
              }`}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="group flex items-center justify-between py-3 rounded-xl -mx-2 px-2">
          <span className="text-sm text-gray-700 w-28 shrink-0">Phone</span>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={() => setEditingField("phone")}
              onBlur={(e) => {
                setEditingField(null);
                save({ phone: e.target.value });
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              placeholder="+61 400 000 000"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${
                editingField === "phone"
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-60"
              }`}
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
              onBlur={(e) => {
                setEditingField(null);
                save({ email: e.target.value });
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              placeholder="contact@example.com"
              className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
            />
            <Pencil
              size={11}
              className={`shrink-0 text-gray-400 transition ${
                editingField === "email"
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-60"
              }`}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="group py-3 rounded-xl -mx-2 px-2">
          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-700 w-28 shrink-0 pt-0.5">
              Notes
            </span>
            <Pencil
              size={11}
              className={`shrink-0 mt-1 text-gray-500 transition ${
                editingField === "notes"
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-60"
              }`}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => setEditingField("notes")}
            onBlur={(e) => {
              setEditingField(null);
              save({ notes: e.target.value });
            }}
            placeholder="Working notes, preferences, things to remember..."
            rows={editingField === "notes" ? 6 : 4}
            className="w-full bg-transparent outline-none border-none resize-none mt-1 text-sm text-gray-500 placeholder:text-gray-300 cursor-pointer focus:cursor-text leading-relaxed"
          />
        </div>
      </div>

      {/* Column 2: Used by */}
      <div>
        <ContactUsedBy contactId={vendor.id} onClose={onClose} />
      </div>
    </div>
  );
}
