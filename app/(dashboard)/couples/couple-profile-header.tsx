/**
 * Header for the Couple Profile overlay (modal).
 *
 * Two responsive variants of the same set of controls:
 * - **Mobile (≤ sm)**: name + status pill + `⋯` actions overflow
 *   menu (call/email/whatsapp + portal links + rotate + delete) +
 *   close button.
 * - **Desktop**: name + status pill + inline action row
 *   (delete · portal-links popover · call/email/whatsapp · close).
 *
 * The header is stateless presentation - the parent passes the
 * `couple` row + callbacks. Status changes call `onSave(couple
 * with new status)`; the parent (or its hook) re-syncs the cache.
 *
 * The mobile / desktop split is intentional: the underlying
 * components (Radix `Popover`) need to render distinct portals per
 * variant. Folding them into one tree caused overlap glitches in
 * the prior single-file profile.
 *
 * @module app/(dashboard)/couples/couple-profile-header
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import {
  Check,
  Clock,
  Copy,
  FileDown,
  Heart,
  Link,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { PiWhatsappLogoLight } from 'react-icons/pi';

import { Couple, CoupleStatusRecord, getStatusClasses } from '@/types/couple';

import { printTimelinePdf, printVowsPdf } from './print-couple-docs';

export interface CoupleProfileHeaderProps {
  couple: Couple;
  statuses: CoupleStatusRecord[];
  onSave: (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ) => void;
  onClose: () => void;
  onRotateLinks: () => void;
  onDeleteRequest: () => void;
}

type CopiedKind = 'couple' | 'vendor' | null;

export function CoupleProfileHeader({
  couple,
  statuses,
  onSave,
  onClose,
  onRotateLinks,
  onDeleteRequest,
}: CoupleProfileHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(couple.name);
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [copied, setCopied] = useState<CopiedKind>(null);

  const hasPhone = !!couple.phone;
  const hasEmail = !!couple.email;
  const currentStatus = statuses.find((s) => s.slug === couple.status);
  const statusName =
    currentStatus?.name ||
    couple.status.charAt(0).toUpperCase() + couple.status.slice(1);
  const statusClasses = currentStatus
    ? getStatusClasses(currentStatus.color)
    : getStatusClasses('gray');

  const handleSaveName = () => {
    if (!nameInput.trim()) {
      setNameInput(couple.name);
      setEditingName(false);
      return;
    }
    setEditingName(false);
    onSave({
      id: couple.id,
      name: nameInput,
      email: couple.email,
      phone: couple.phone,
      status: couple.status,
      lead_source: couple.lead_source,
      kanban_position: couple.kanban_position,
      notes: couple.notes,
      event_date: couple.event_date,
      venue: couple.venue,
    });
  };

  const copyLink = (type: 'couple' | 'vendor') => {
    if (!couple.portal_token) return;
    const base = `${window.location.origin}/portal/${couple.portal_token}`;
    const url = type === 'vendor' ? `${base}/vendor` : base;
    navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="shrink-0 border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Name + status pill (shared mobile + desktop) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {editingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="min-w-0 flex-1 text-lg font-semibold text-gray-900 placeholder:text-gray-400 bg-transparent border-none outline-none transition"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setNameInput(couple.name);
                setEditingName(true);
              }}
              className="group flex items-center gap-1.5 min-w-0 cursor-pointer text-left"
            >
              <span className="text-lg font-semibold text-gray-900 truncate transition">
                {couple.name}
              </span>
              <Pencil
                size={12}
                strokeWidth={1.5}
                className="shrink-0 text-gray-400 opacity-0 group-hover:opacity-60 transition"
              />
            </button>
          )}

          <Popover.Root open={statusOpen} onOpenChange={setStatusOpen}>
            <Popover.Trigger asChild>
              <button
                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition hover:opacity-80 ${statusClasses.pill}`}
              >
                {statusName}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-44"
                sideOffset={4}
                align="start"
              >
                {statuses.map((s) => {
                  const cls = getStatusClasses(s.color);
                  return (
                    <button
                      key={s.slug}
                      onClick={() => {
                        onSave({
                          id: couple.id,
                          name: couple.name,
                          email: couple.email,
                          phone: couple.phone,
                          status: s.slug,
                          lead_source: couple.lead_source,
                          kanban_position: couple.kanban_position,
                          notes: couple.notes,
                          event_date: couple.event_date,
                          venue: couple.venue,
                        });
                        setStatusOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2 ${
                        couple.status === s.slug
                          ? 'bg-gray-100 font-medium text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${cls.dot}`}
                      />
                      {s.name}
                    </button>
                  );
                })}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Mobile: ⋯ actions overflow */}
        <div className="sm:hidden">
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
                className="bg-white border border-gray-200 rounded-xl shadow-lg z-[70] w-52 py-1.5"
                sideOffset={6}
                align="end"
              >
                <a
                  href={hasPhone ? `tel:${couple.phone}` : undefined}
                  onClick={(e) => {
                    if (!hasPhone) e.preventDefault();
                    else setActionsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm transition ${
                    hasPhone
                      ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  Call
                  <Phone size={14} strokeWidth={1.5} />
                </a>
                <a
                  href={hasEmail ? `mailto:${couple.email}` : undefined}
                  onClick={(e) => {
                    if (!hasEmail) e.preventDefault();
                    else setActionsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm transition ${
                    hasEmail
                      ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  Email
                  <Mail size={14} strokeWidth={1.5} />
                </a>
                <a
                  href={
                    hasPhone
                      ? `https://wa.me/${couple.phone.replace(/\D/g, '')}`
                      : undefined
                  }
                  target={hasPhone ? '_blank' : undefined}
                  rel={hasPhone ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (!hasPhone) e.preventDefault();
                    else setActionsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm transition ${
                    hasPhone
                      ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  WhatsApp
                  <PiWhatsappLogoLight size={15} />
                </a>

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      copyLink('couple');
                      setTimeout(() => setActionsOpen(false), 900);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <span>Couple portal link</span>
                    {copied === 'couple' ? (
                      <Check
                        size={12}
                        strokeWidth={2}
                        className="text-emerald-500"
                      />
                    ) : (
                      <Copy size={12} strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      copyLink('vendor');
                      setTimeout(() => setActionsOpen(false), 900);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <span>Vendor link</span>
                    {copied === 'vendor' ? (
                      <Check
                        size={12}
                        strokeWidth={2}
                        className="text-emerald-500"
                      />
                    ) : (
                      <Copy size={12} strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onRotateLinks();
                      setActionsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                  >
                    Rotate links
                    <RefreshCw size={13} strokeWidth={1.5} />
                  </button>
                </div>

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    data-testid="delete-couple-btn"
                    onClick={() => {
                      onDeleteRequest();
                      setActionsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer"
                  >
                    Delete couple
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Desktop: inline action row */}
        <div className="hidden sm:flex items-center">
          <button
            onClick={onDeleteRequest}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-2" />
          <Popover.Root open={linkOpen} onOpenChange={setLinkOpen}>
            <Popover.Trigger asChild>
              <button
                title="Portal links"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                <Link size={16} strokeWidth={1.5} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                sideOffset={6}
                className="z-[80] w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm"
              >
                <button
                  onClick={() => {
                    copyLink('couple');
                    setTimeout(() => setLinkOpen(false), 900);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  <span>Couple portal link</span>
                  {copied === 'couple' ? (
                    <Check
                      size={13}
                      strokeWidth={2}
                      className="text-emerald-500"
                    />
                  ) : (
                    <Copy size={13} strokeWidth={1.5} />
                  )}
                </button>
                <button
                  onClick={() => {
                    copyLink('vendor');
                    setTimeout(() => setLinkOpen(false), 900);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  <span>Vendor link</span>
                  {copied === 'vendor' ? (
                    <Check
                      size={13}
                      strokeWidth={2}
                      className="text-emerald-500"
                    />
                  ) : (
                    <Copy size={13} strokeWidth={1.5} />
                  )}
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      onRotateLinks();
                      setLinkOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-gray-500 hover:bg-gray-50 transition cursor-pointer"
                  >
                    Rotate links
                    <RefreshCw size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <div className="w-px h-4 bg-gray-200 mx-2" />
          <Popover.Root open={pdfOpen} onOpenChange={setPdfOpen}>
            <Popover.Trigger asChild>
              <button
                title="Generate PDF"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                <FileDown size={16} strokeWidth={1.5} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                sideOffset={6}
                className="z-[80] w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm"
              >
                <button
                  onClick={() => {
                    void printVowsPdf(couple.id, {
                      primary: couple.primary_name ?? couple.name,
                      secondary: couple.secondary_name ?? null,
                    });
                    setPdfOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  <span>Vows PDF</span>
                  <Heart size={13} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => {
                    void printTimelinePdf(couple.id, couple.name);
                    setPdfOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  <span>Timeline PDF</span>
                  <Clock size={13} strokeWidth={1.5} />
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <div className="w-px h-4 bg-gray-200 mx-2" />
          <div className="flex items-center gap-0.5">
            <a
              href={hasPhone ? `tel:${couple.phone}` : undefined}
              className={`p-1.5 rounded-lg transition ${
                hasPhone
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer'
                  : 'text-gray-200 cursor-not-allowed pointer-events-none'
              }`}
            >
              <Phone size={16} strokeWidth={1.5} />
            </a>
            <a
              href={hasEmail ? `mailto:${couple.email}` : undefined}
              className={`p-1.5 rounded-lg transition ${
                hasEmail
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer'
                  : 'text-gray-200 cursor-not-allowed pointer-events-none'
              }`}
            >
              <Mail size={16} strokeWidth={1.5} />
            </a>
            <a
              href={
                hasPhone
                  ? `https://wa.me/${couple.phone.replace(/\D/g, '')}`
                  : undefined
              }
              target={hasPhone ? '_blank' : undefined}
              rel={hasPhone ? 'noopener noreferrer' : undefined}
              className={`p-1.5 rounded-lg transition ${
                hasPhone
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer'
                  : 'text-gray-200 cursor-not-allowed pointer-events-none'
              }`}
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

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="sm:hidden shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
