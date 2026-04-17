"use client";

import { useState, useEffect } from "react";
import {
  X,
  Phone,
  Mail,
  Trash2,
  Check,
  Copy,
  LayoutDashboard,
  CheckSquare,
  FileText,
  Receipt,
  Users,
  Clock,
  Music,
  Paperclip,
  Activity,
  MoreHorizontal,
} from "lucide-react";
import { PiWhatsappLogoLight } from "react-icons/pi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import * as Popover from "@radix-ui/react-popover";
import {
  Couple,
  LeadSource,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  getStatusClasses,
} from "./couples-types";
import { useCoupleStatuses } from "./use-couple-statuses";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoupleOverview } from "./couple-overview";
import { CoupleTasks } from "./couple-tasks";
import { CouplePayments } from "./couple-payments";
import { usePortalData } from "./use-portal-data";
import { PersonModal, SongModal } from "./portal-modals";
import { McPortalNames } from "./mc-portal-names";
import { McPortalSongs } from "./mc-portal-songs";
import { McPortalFiles } from "./mc-portal-files";
import { CoupleTimeline } from "./couple-timeline";
import { CouplePulse } from "./couple-pulse";

type Section =
  | "overview"
  | "pulse"
  | "tasks"
  | "payments"
  | "names"
  | "timeline"
  | "songs"
  | "files";

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
  },
  {
    key: "pulse",
    label: "Pulse",
    icon: <Activity size={18} strokeWidth={1.5} />,
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: <CheckSquare size={18} strokeWidth={1.5} />,
  },
  {
    key: "payments",
    label: "Payments",
    icon: <Receipt size={18} strokeWidth={1.5} />,
  },
  { key: "names", label: "Names", icon: <Users size={18} strokeWidth={1.5} /> },
  {
    key: "timeline",
    label: "Timeline",
    icon: <Clock size={18} strokeWidth={1.5} />,
  },
  { key: "songs", label: "Songs", icon: <Music size={18} strokeWidth={1.5} /> },
  {
    key: "files",
    label: "Files",
    icon: <Paperclip size={18} strokeWidth={1.5} />,
  },
];

interface CoupleProfileProps {
  couple: Couple | null;
  onClose: () => void;
  onSave: (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => void;
  onDelete: (id: string) => void;
  loading: boolean;
  defaultTab?: Section;
}

export function CoupleProfile({
  couple,
  onClose,
  onSave,
  onDelete,
  loading,
  defaultTab = "overview",
}: CoupleProfileProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: statuses } = useCoupleStatuses();
  const [activeSection, setActiveSection] = useState<Section>(defaultTab);
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [copied, setCopied] = useState<"couple" | "vendor" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const portal = usePortalData(couple?.id ?? "");

  const togglePortal = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("couples")
        .update({ portal_token_enabled: enabled })
        .eq("id", couple?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couples"] });
    },
    onError: () => toast('Failed to update portal settings'),
  });

  const copyLink = (type: "couple" | "vendor") => {
    if (!couple?.portal_token) return;
    const base = `${window.location.origin}/portal/${couple.portal_token}`;
    const url = type === "vendor" ? `${base}/vendor` : base;
    navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    setActiveSection(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (couple) {
      setNameInput(couple.name);
    }
    setActiveSection(defaultTab);
    setDeleteConfirm(false);
  }, [couple]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (couple) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }
  }, [couple, onClose]);

  if (!couple) return null;

  const hasPhone = !!couple.phone;
  const hasEmail = !!couple.email;
  const currentStatus = statuses.find((s) => s.slug === couple.status);
  const statusName =
    currentStatus?.name ||
    couple.status.charAt(0).toUpperCase() + couple.status.slice(1);
  const statusClasses = currentStatus
    ? getStatusClasses(currentStatus.color)
    : getStatusClasses("gray");

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
          data-testid="couple-profile-panel"
          className="bg-white rounded-2xl shadow-xl w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact header */}
          <div className="shrink-0 border-b border-gray-200 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Name + status inline */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {editingName ? (
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-lg font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-lg font-semibold text-gray-900 truncate hover:text-blue-600 transition cursor-pointer text-left"
                  >
                    {couple.name}
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
                                ? "bg-gray-100 font-medium text-gray-900"
                                : "text-gray-700 hover:bg-gray-50"
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

              {/* Actions dropdown */}
              <Popover.Root open={actionsOpen} onOpenChange={setActionsOpen}>
                <Popover.Trigger asChild>
                  <button
                    title="Actions"
                    className="shrink-0 p-1.5 sm:p-2 ring-1 ring-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 transition cursor-pointer"
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
                    {/* Contact actions */}
                    <a
                      href={hasPhone ? `tel:${couple.phone}` : undefined}
                      onClick={(e) => { if (!hasPhone) e.preventDefault(); else setActionsOpen(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasPhone ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                    >
                      <Phone size={14} strokeWidth={1.5} />
                      Call
                    </a>
                    <a
                      href={hasEmail ? `mailto:${couple.email}` : undefined}
                      onClick={(e) => { if (!hasEmail) e.preventDefault(); else setActionsOpen(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasEmail ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                    >
                      <Mail size={14} strokeWidth={1.5} />
                      Email
                    </a>
                    <a
                      href={hasPhone ? `https://wa.me/${couple.phone.replace(/\D/g, "")}` : undefined}
                      target={hasPhone ? "_blank" : undefined}
                      rel={hasPhone ? "noopener noreferrer" : undefined}
                      onClick={(e) => { if (!hasPhone) e.preventDefault(); else setActionsOpen(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${hasPhone ? "text-gray-700 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                    >
                      <PiWhatsappLogoLight size={15} />
                      WhatsApp
                    </a>

                    {/* Portal section */}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm text-gray-700">Portal</p>
                          <p className="text-xs text-gray-400">
                            {couple.portal_token_enabled ? "Active" : "Disabled"}
                          </p>
                        </div>
                        <button
                          onClick={() => togglePortal.mutate(!couple.portal_token_enabled)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${couple.portal_token_enabled ? "bg-black" : "bg-gray-200"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${couple.portal_token_enabled ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                      <button
                        onClick={() => copyLink("couple")}
                        disabled={!couple.portal_token}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer disabled:opacity-40"
                      >
                        <span>Copy couple link</span>
                        {copied === "couple" ? <Check size={12} strokeWidth={2} className="text-emerald-500" /> : <Copy size={12} strokeWidth={1.5} className="text-gray-400" />}
                      </button>
                      <button
                        onClick={() => copyLink("vendor")}
                        disabled={!couple.portal_token}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer disabled:opacity-40"
                      >
                        <span>Copy vendor link</span>
                        {copied === "vendor" ? <Check size={12} strokeWidth={2} className="text-emerald-500" /> : <Copy size={12} strokeWidth={1.5} className="text-gray-400" />}
                      </button>
                    </div>

                    {/* Delete */}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        data-testid="delete-couple-btn"
                        onClick={() => { setDeleteConfirm(true); setActionsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                        Delete couple
                      </button>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <button
                onClick={onClose}
                className="shrink-0 p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Body: Nav + Content */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            {/* Mobile: horizontal scrollable tab bar */}
            <div className="sm:hidden shrink-0 border-b border-gray-200 overflow-x-auto">
              <div className="flex px-2 py-2 gap-1 min-w-max">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                      activeSection === item.key
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: sidebar navigation */}
            <nav className="hidden sm:block w-[200px] shrink-0 border-r border-gray-200 overflow-y-auto px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
                    activeSection === item.key
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Content area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col">
              {activeSection === "overview" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CoupleOverview couple={couple} onSave={onSave} />
                </div>
              )}

              {activeSection === "pulse" && (
                <CouplePulse couple={couple} />
              )}

              {activeSection === "tasks" && (
                <CoupleTasks coupleId={couple.id} />
              )}
              {activeSection === "payments" && (
                <CouplePayments coupleId={couple.id} coupleName={couple.name} />
              )}

              {activeSection === "names" && (
                <McPortalNames
                  people={portal.people}
                  isLoading={portal.isPeopleLoading}
                  onEditPerson={portal.openEditPerson}
                  onAddPerson={portal.openAddPerson}
                />
              )}
              {activeSection === "timeline" && (
                <CoupleTimeline coupleId={couple.id} />
              )}
              {activeSection === "songs" && (
                <McPortalSongs
                  coupleId={couple.id}
                  onEditSong={portal.openEditSong}
                  onAddSong={portal.openAddSong}
                />
              )}
              {activeSection === "files" && (
                <McPortalFiles coupleId={couple.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Portal modals */}
      <PersonModal
        isOpen={portal.personModal}
        onClose={() => {
          portal.setPersonModal(false);
          portal.setEditingPerson(null);
        }}
        onSave={portal.savePerson}
        onDelete={portal.editingPerson ? portal.deletePerson : undefined}
        person={portal.editingPerson}
        roleOptions={portal.personRoles}
        coupleId={couple.id}
        saving={portal.personSaving}
      />
      <SongModal
        isOpen={portal.songModal}
        onClose={() => {
          portal.setSongModal(false);
          portal.setEditingSong(null);
        }}
        onSave={portal.saveSong}
        onDelete={portal.editingSong ? portal.deleteSong : undefined}
        song={portal.editingSong}
        categoryLabel={portal.songCategoryLabel}
        saving={portal.songSaving}
      />

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Couple"
        description="Are you sure you want to delete this couple? This cannot be undone."
        onConfirm={() => {
          if (couple) onDelete(couple.id);
        }}
        onCancel={() => setDeleteConfirm(false)}
        loading={loading}
      />
    </>
  );
}
