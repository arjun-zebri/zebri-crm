"use client";

import { Contact, CATEGORY_LABELS } from "./contacts-types";
import { Badge } from "@/components/ui/badge";

interface ContactOverviewProps {
  vendor: Contact;
  onEditClick: () => void;
}

export function ContactOverview({ vendor }: ContactOverviewProps) {
  const fields = [
    {
      label: "Contact person",
      value: vendor.contact_name || null,
      render: null as React.ReactNode | null,
    },
    {
      label: "Phone",
      value: vendor.phone || null,
      render: vendor.phone ? (
        <a
          href={`tel:${vendor.phone}`}
          className="text-sm text-gray-900 hover:text-blue-600 transition"
        >
          {vendor.phone}
        </a>
      ) : null,
    },
    {
      label: "Email",
      value: vendor.email || null,
      render: vendor.email ? (
        <a
          href={`mailto:${vendor.email}`}
          className="text-sm text-gray-900 hover:text-blue-600 transition truncate max-w-[60%] text-right"
        >
          {vendor.email}
        </a>
      ) : null,
    },
    {
      label: "Category",
      value: "badge",
      render: (
        <Badge variant={vendor.category as any}>
          {CATEGORY_LABELS[vendor.category]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Fields */}
      <div>
        {fields.map(({ label, value, render }) => (
          <div
            key={label}
            className="flex items-center justify-between py-2.5 border-b border-gray-50"
          >
            <span className="text-sm text-gray-400 shrink-0">{label}</span>
            {render ? (
              render
            ) : value ? (
              <span className="text-sm text-gray-900">{value}</span>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Notes — expands to fill remaining height */}
      <div className="flex flex-col flex-1 min-h-0 pt-2.5">
        <span className="text-sm text-gray-400 mb-2">Notes</span>
        <div className="flex-1">
          {vendor.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {vendor.notes}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
