"use client";

import { Store } from "lucide-react";
import { Contact, CATEGORIES, CATEGORY_LABELS } from "./contacts-types";

interface ContactsListProps {
  vendors: Contact[];
  onRowClick: (contact: Contact) => void;
  loading: boolean;
}

export function ContactsList({ vendors, onRowClick, loading }: ContactsListProps) {
  if (loading) {
    return (
      <div className="space-y-8 pb-6 overflow-y-auto h-full">
        {[3, 2].map((count, gi) => (
          <div key={gi}>
            <div className="h-4 bg-gray-100 rounded-md w-28 mb-3 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="animate-pulse border border-gray-100 rounded-xl p-4">
                  <div className="h-4 bg-gray-100 rounded-md w-36 mb-2" />
                  <div className="h-3 bg-gray-100 rounded-md w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Store size={40} className="text-gray-300 mb-3" strokeWidth={1.5} />
        <p className="text-gray-600 font-medium mb-2">No contacts yet.</p>
        <p className="text-sm text-gray-500">Start building your contact network.</p>
      </div>
    );
  }

  const groups = CATEGORIES
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      contacts: vendors.filter((c) => c.category === category),
    }))
    .filter((g) => g.contacts.length > 0);

  return (
    <div className="space-y-8 pb-6 overflow-y-auto h-full">
      {groups.map((group) => (
        <div key={group.category}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
            <span className="text-xs text-gray-400">{group.contacts.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onRowClick(contact)}
                className={`text-left border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:bg-gray-50/60 transition cursor-pointer w-full ${
                  contact.status === "inactive" ? "opacity-50" : ""
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                {contact.contact_name && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.contact_name}</p>
                )}
                {(contact.email || contact.phone) && (
                  <div className="mt-2 space-y-0.5">
                    {contact.email && (
                      <p className="text-xs text-gray-400 truncate">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-xs text-gray-400 truncate">{contact.phone}</p>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
