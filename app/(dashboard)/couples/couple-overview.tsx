"use client";

import * as Popover from "@radix-ui/react-popover";
import { Pencil, Plus } from "lucide-react";
import { useState, useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Couple,
  LEAD_SOURCE_LABELS,
  LeadSource,
  LEAD_SOURCES,
} from '@/types/couple';

import { CoupleEvents, type CoupleEventsHandle } from "./couple-events";
import { CoupleTabShell } from "./couple-tab-shell";

interface CoupleOverviewProps {
  couple: Couple;
  onSave: (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
}

type EditField =
  | "primary_name"
  | "primary_email"
  | "primary_phone"
  | "secondary_name"
  | "secondary_email"
  | "secondary_phone"
  | "leadSource"
  | "notes"
  | null;

export function CoupleOverview({ couple, onSave }: CoupleOverviewProps) {
  const [editingField, setEditingField] = useState<EditField>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const isLoading = eventsLoading;
  const handleEventsLoading = useCallback((v: boolean) => setEventsLoading(v), []);
  const eventsRef = useRef<CoupleEventsHandle>(null);
  const [primaryName, setPrimaryName] = useState(couple.primary_name ?? "");
  const [primaryEmail, setPrimaryEmail] = useState(couple.primary_email ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(couple.primary_phone ?? "");
  const [secondaryName, setSecondaryName] = useState(couple.secondary_name ?? "");
  const [secondaryEmail, setSecondaryEmail] = useState(couple.secondary_email ?? "");
  const [secondaryPhone, setSecondaryPhone] = useState(couple.secondary_phone ?? "");
  const [leadSource, setLeadSource] = useState(couple.lead_source || "");
  const [notes, setNotes] = useState(couple.notes ?? "");
  const [leadSourceOpen, setLeadSourceOpen] = useState(false);

  const leadSourceLabel = leadSource
    ? LEAD_SOURCE_LABELS[leadSource as LeadSource] ?? leadSource
    : null;

  const handleSaveField = (field: string, value: string | null) => {
    setEditingField(null);
    const empty = (v: string) => (v.trim() === "" ? null : v.trim());
    onSave({
      id: couple.id,
      name: couple.name,
      // Legacy couple-level email/phone are no longer surfaced here -
      // they remain in the DB row untouched.
      email: couple.email,
      phone: couple.phone,
      primary_name:
        field === "primary_name" ? (value && value.trim() ? value.trim() : null) : empty(primaryName),
      primary_email:
        field === "primary_email" ? (value && value.trim() ? value.trim() : null) : empty(primaryEmail),
      primary_phone:
        field === "primary_phone" ? (value && value.trim() ? value.trim() : null) : empty(primaryPhone),
      secondary_name:
        field === "secondary_name" ? (value && value.trim() ? value.trim() : null) : empty(secondaryName),
      secondary_email:
        field === "secondary_email" ? (value && value.trim() ? value.trim() : null) : empty(secondaryEmail),
      secondary_phone:
        field === "secondary_phone" ? (value && value.trim() ? value.trim() : null) : empty(secondaryPhone),
      status: couple.status,
      lead_source: field === "leadSource" ? value : leadSource || null,
      kanban_position: couple.kanban_position,
      notes: field === "notes" ? (value ?? "") : notes,
      event_date: couple.event_date,
      venue: couple.venue,
    });
  };

  return (
    <CoupleTabShell
      title="Overview"
      actions={
        <Button
          size="sm"
          onClick={() => eventsRef.current?.openAdd()}
          className="cursor-pointer gap-1.5"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add event
        </Button>
      }
    >
      {/* Skeleton - shown while events or contacts are loading */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 animate-pulse">
          <div className="space-y-4">
            <div className="h-3 w-16 bg-surface-emphasis rounded-pill" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="h-3 w-20 bg-surface-emphasis rounded-pill" />
                <div className="h-3 w-32 bg-surface-emphasis rounded-pill" />
              </div>
            ))}
            <div className="h-16 bg-surface-emphasis rounded-control mt-2" />
          </div>
          <div>
            <div className="h-3 w-16 bg-surface-emphasis rounded-pill mb-4" />
            {[1, 2].map((i) => <div key={i} className="h-10 bg-surface-emphasis rounded-control mb-2" />)}
          </div>
        </div>
      )}

      {/* Real content - always mounted so queries fire; hidden via CSS while loading */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 flex-1 min-h-0 ${isLoading ? 'hidden' : ''}`}>
      {/* Column 1: General Info */}
      <div className="flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text">General</h3>
        </div>

        {/* Primary + Secondary partner contacts. Six inline-editable
            rows in total, grouped under quiet section subheaders so
            scanning the column still feels coherent. Each row keeps
            the hover-pencil affordance used elsewhere. */}
        <PartnerBlock
          label="Primary contact"
          name={primaryName}
          email={primaryEmail}
          phone={primaryPhone}
          setName={setPrimaryName}
          setEmail={setPrimaryEmail}
          setPhone={setPrimaryPhone}
          editingField={editingField}
          startEdit={(f) => setEditingField(f)}
          save={(field, value) => handleSaveField(field, value)}
          fieldNames={{
            name: "primary_name",
            email: "primary_email",
            phone: "primary_phone",
          }}
        />
        <PartnerBlock
          label="Secondary contact"
          name={secondaryName}
          email={secondaryEmail}
          phone={secondaryPhone}
          setName={setSecondaryName}
          setEmail={setSecondaryEmail}
          setPhone={setSecondaryPhone}
          editingField={editingField}
          startEdit={(f) => setEditingField(f)}
          save={(field, value) => handleSaveField(field, value)}
          fieldNames={{
            name: "secondary_name",
            email: "secondary_email",
            phone: "secondary_phone",
          }}
        />

        {/* Lead Source */}
        <div
          className="group flex items-center justify-between py-3 rounded-control -mx-2 px-2 cursor-pointer"
          onClick={() => {
            if (editingField !== "leadSource") {
              setEditingField("leadSource");
              setLeadSourceOpen(true);
            }
          }}
        >
          <span className="text-sm text-gray-700 w-28 shrink-0">
            Lead source
          </span>
          {editingField === "leadSource" ? (
            <Popover.Root
              open={leadSourceOpen}
              onOpenChange={(open) => {
                setLeadSourceOpen(open);
                if (!open) setEditingField(null);
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-end gap-1 text-sm bg-transparent outline-none border-none cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={leadSource ? "text-text" : "text-text-subtle"}>
                    {leadSource
                      ? LEAD_SOURCE_LABELS[leadSource as LeadSource]
                      : "Select source"}
                  </span>
                  <Pencil size={11} className="opacity-60 shrink-0 text-text-muted" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-surface border border-border rounded-control shadow-lg py-1 z-[70] w-48"
                  sideOffset={4}
                  align="end"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSource("");
                      handleSaveField("leadSource", null);
                      setLeadSourceOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      !leadSource
                        ? "bg-surface-emphasis text-text font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    None
                  </button>
                  {LEAD_SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setLeadSource(s);
                        handleSaveField("leadSource", s);
                        setLeadSourceOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        leadSource === s
                          ? "bg-surface-emphasis text-text font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {LEAD_SOURCE_LABELS[s]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
              {leadSourceLabel ? (
                <span className="text-sm text-text-muted">{leadSourceLabel}</span>
              ) : (
                <span className="text-sm text-gray-300"> - </span>
              )}
              <Pencil
                size={11}
                className="opacity-0 group-hover:opacity-60 shrink-0 text-text-subtle"
              />
            </div>
          )}
        </div>

        {/* How did you hear about me - captured by the lead-capture form.
            Read-only here; edited via the couple modal. */}
        {couple.referral_source ? (
          <div className="flex items-center justify-between py-3 -mx-2 px-2">
            <span className="text-sm text-gray-700 w-28 shrink-0">Heard via</span>
            <span className="flex-1 text-right text-sm text-text-muted min-w-0 break-words">
              {couple.referral_source}
            </span>
          </div>
        ) : null}

        {/* Notes */}
        <div className="group flex-1 flex flex-col py-3 rounded-control -mx-2 px-2 min-h-0">
          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-700 w-28 shrink-0 pt-0.5">Notes</span>
            <Pencil
              size={11}
              className={`shrink-0 mt-1 text-text-muted transition ${editingField === "notes" ? "opacity-0" : "opacity-0 group-hover:opacity-60"}`}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => setEditingField("notes")}
            onBlur={() => handleSaveField("notes", notes)}
            placeholder="Any additional notes..."
            className="flex-1 w-full bg-transparent outline-none border-none resize-none mt-1 text-sm text-text-muted placeholder:text-gray-300 cursor-pointer focus:cursor-text leading-relaxed min-h-[6rem]"
          />
        </div>
      </div>

      {/* Column 2: Events */}
      <div>
        <CoupleEvents ref={eventsRef} couple={couple} onLoadingChange={handleEventsLoading} />
      </div>
    </div>
  </CoupleTabShell>
  );
}

interface PartnerBlockProps {
  label: string;
  name: string;
  email: string;
  phone: string;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  editingField: EditField;
  startEdit: (field: EditField) => void;
  save: (field: string, value: string | null) => void;
  fieldNames: { name: string; email: string; phone: string };
}

function PartnerBlock({
  label,
  name,
  email,
  phone,
  setName,
  setEmail,
  setPhone,
  editingField,
  startEdit,
  save,
  fieldNames,
}: PartnerBlockProps) {
  return (
    <div className="mt-2 first:mt-0">
      <h4 className="text-xs uppercase tracking-wider text-text-subtle mt-3 mb-1">
        {label}
      </h4>
      <EditableRow
        label="Name"
        type="text"
        value={name}
        setValue={setName}
        placeholder="Full name"
        fieldName={fieldNames.name as EditField}
        editingField={editingField}
        startEdit={startEdit}
        save={save}
      />
      <EditableRow
        label="Email"
        type="email"
        value={email}
        setValue={setEmail}
        placeholder="email@example.com"
        fieldName={fieldNames.email as EditField}
        editingField={editingField}
        startEdit={startEdit}
        save={save}
      />
      <EditableRow
        label="Phone"
        type="tel"
        value={phone}
        setValue={setPhone}
        placeholder="+61 400 000 000"
        fieldName={fieldNames.phone as EditField}
        editingField={editingField}
        startEdit={startEdit}
        save={save}
      />
    </div>
  );
}

interface EditableRowProps {
  label: string;
  type: "text" | "email" | "tel";
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  fieldName: EditField;
  editingField: EditField;
  startEdit: (field: EditField) => void;
  save: (field: string, value: string | null) => void;
}

function EditableRow({
  label,
  type,
  value,
  setValue,
  placeholder,
  fieldName,
  editingField,
  startEdit,
  save,
}: EditableRowProps) {
  const isEditing = editingField === fieldName;
  return (
    <div className="group flex items-center justify-between py-2 rounded-control -mx-2 px-2">
      <span className="text-sm text-text-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => startEdit(fieldName)}
          onBlur={() => save(fieldName ?? "", value || null)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.target as HTMLInputElement).blur()
          }
          placeholder={placeholder}
          className="flex-1 text-right bg-transparent outline-none border-none text-sm text-gray-700 placeholder:text-gray-300 cursor-pointer focus:cursor-text"
        />
        <Pencil
          size={11}
          className={`shrink-0 text-text-subtle transition ${isEditing ? "opacity-0" : "opacity-0 group-hover:opacity-60"}`}
        />
      </div>
    </div>
  );
}
