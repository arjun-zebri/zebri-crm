"use client";

import { Store, ChevronRight, User, Mail, Phone } from "lucide-react";
import { Fragment, useState } from "react";

import { Contact, CATEGORIES, CATEGORY_LABELS } from '@/types/contact';

const INACTIVE_KEY = "__inactive__";

const COL_WIDTHS = {
  name: "32%",
  contact: "20%",
  email: "30%",
  phone: "18%",
} as const;

interface ContactsListProps {
  vendors: Contact[];
  onRowClick: (contact: Contact) => void;
  loading: boolean;
}

interface Group {
  key: string;
  label: string;
  contacts: Contact[];
}

function ColumnHeaderRow() {
  return (
    <tr>
      <th
        className="px-0 py-1.5 text-left text-xs font-normal text-text-subtle border-b border-border"
        style={{ width: COL_WIDTHS.name }}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[11px]">Aa</span>
          Name
        </span>
      </th>
      <th
        className="px-0 py-1.5 text-left text-xs font-normal text-text-subtle border-b border-border"
        style={{ width: COL_WIDTHS.contact }}
      >
        <span className="flex items-center gap-1.5">
          <User size={12} strokeWidth={1.5} />
          Contact
        </span>
      </th>
      <th
        className="px-0 py-1.5 text-left text-xs font-normal text-text-subtle border-b border-border hidden md:table-cell"
        style={{ width: COL_WIDTHS.email }}
      >
        <span className="flex items-center gap-1.5">
          <Mail size={12} strokeWidth={1.5} />
          Email
        </span>
      </th>
      <th
        className="px-0 py-1.5 text-left text-xs font-normal text-text-subtle border-b border-border hidden lg:table-cell"
        style={{ width: COL_WIDTHS.phone }}
      >
        <span className="flex items-center gap-1.5">
          <Phone size={12} strokeWidth={1.5} />
          Phone
        </span>
      </th>
    </tr>
  );
}

export function ContactsList({ vendors, onRowClick, loading }: ContactsListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    [INACTIVE_KEY]: true,
  });

  const knownCategories = new Set<string>(CATEGORIES);
  const active = vendors.filter((c) => c.status !== "inactive");
  const inactive = vendors.filter((c) => c.status === "inactive");

  const categoryGroups: Group[] = CATEGORIES.map((category) => ({
    key: category,
    label: CATEGORY_LABELS[category],
    contacts: active.filter((c) =>
      category === "other"
        ? c.category === "other" || !knownCategories.has(c.category)
        : c.category === category
    ),
  })).filter((g) => g.contacts.length > 0);

  const groups: Group[] = [...categoryGroups];
  if (inactive.length > 0) {
    groups.push({
      key: INACTIVE_KEY,
      label: "Inactive",
      contacts: inactive,
    });
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!loading && vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Store size={40} className="text-gray-300 mb-3" strokeWidth={1.5} />
        <p className="text-gray-600 font-medium mb-2">No contacts yet.</p>
        <p className="text-sm text-text-muted">Start building your contact network.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        {/* ── Mobile card list ── */}
        <div className="sm:hidden pb-6">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 pr-3">
                    <div className="h-4 bg-surface-emphasis rounded-control w-36 mb-1.5" />
                    <div className="h-3 bg-surface-emphasis rounded-control w-24" />
                  </div>
                </div>
              ))
            : groups.map((group) => {
                const isCollapsed = !!collapsed[group.key];
                return (
                  <div key={group.key} className="mb-4 last:mb-0">
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      className="flex items-center gap-2 w-full text-left py-2"
                    >
                      <h3 className="text-sm font-semibold text-text">
                        {group.label}
                      </h3>
                      <span className="text-xs text-text-subtle">
                        {group.contacts.length}
                      </span>
                      <ChevronRight
                        size={14}
                        strokeWidth={1.5}
                        className={`text-text-subtle transition-transform ${
                          isCollapsed ? "" : "rotate-90"
                        }`}
                      />
                    </button>

                    {!isCollapsed &&
                      group.contacts.map((contact) => {
                        const secondary = [
                          contact.contact_name,
                          contact.email,
                          contact.phone,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <div
                            key={contact.id}
                            data-testid="contact-row"
                            data-contact-name={contact.name}
                            onClick={() => onRowClick(contact)}
                            className="flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 transition"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="text-sm font-medium text-text truncate">
                                {contact.name}
                              </p>
                              {secondary && (
                                <p className="text-xs text-text-subtle mt-0.5 truncate">
                                  {secondary}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
        </div>

        {/* ── Desktop table ── */}
        <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[400px] md:max-w-[1800px]">
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[0, 1, 2, 3].map((j) => (
                      <td key={j} className="px-0 py-2 border-b border-gray-100">
                        <div className="h-4 bg-surface-emphasis rounded-control w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : groups.map((group) => {
                  const isCollapsed = !!collapsed[group.key];
                  return (
                    <Fragment key={group.key}>
                      {/* Group toggle row */}
                      <tr
                        onClick={() => toggle(group.key)}
                        className="cursor-pointer group/h"
                      >
                        <td
                          colSpan={4}
                          className="px-0 pt-6 pb-2"
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-text">
                              {group.label}
                            </h3>
                            <span className="text-xs text-text-subtle">
                              {group.contacts.length}
                            </span>
                            <ChevronRight
                              size={14}
                              strokeWidth={1.5}
                              className={`text-text-subtle transition-transform ${
                                isCollapsed ? "" : "rotate-90"
                              }`}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Column header row - repeats under each group label */}
                      <ColumnHeaderRow />

                      {!isCollapsed &&
                        group.contacts.map((contact) => (
                          <tr
                            key={contact.id}
                            data-testid="contact-row"
                            data-contact-name={contact.name}
                            onClick={() => onRowClick(contact)}
                            className="cursor-pointer transition group hover:bg-gray-50/60"
                          >
                            <td
                              className="px-0 py-2 text-sm overflow-hidden border-b border-gray-100"
                              style={{ width: COL_WIDTHS.name }}
                            >
                              <span className="text-sm text-text-muted group-hover:text-text truncate block">
                                {contact.name}
                              </span>
                            </td>
                            <td
                              className="px-0 py-2 text-sm overflow-hidden border-b border-gray-100"
                              style={{ width: COL_WIDTHS.contact }}
                            >
                              <span className="text-sm text-text-muted group-hover:text-text truncate block">
                                {contact.contact_name}
                              </span>
                            </td>
                            <td
                              className="px-0 py-2 text-sm overflow-hidden border-b border-gray-100 hidden md:table-cell"
                              style={{ width: COL_WIDTHS.email }}
                            >
                              <span className="text-sm text-text-muted group-hover:text-text truncate block">
                                {contact.email}
                              </span>
                            </td>
                            <td
                              className="px-0 py-2 text-sm overflow-hidden border-b border-gray-100 hidden lg:table-cell"
                              style={{ width: COL_WIDTHS.phone }}
                            >
                              <span className="text-sm text-text-muted group-hover:text-text">
                                {contact.phone}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
