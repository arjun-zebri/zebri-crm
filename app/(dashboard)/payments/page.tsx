"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  FileSignature,
  Receipt,
  Search,
  X,
  Plus,
  Hash,
  Users,
  ListChecks,
  DollarSign,
  Calendar,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { QuoteBuilderModal } from "../quotes/quote-builder-modal";
import { InvoiceBuilderModal } from "../invoices/invoice-builder-modal";
import { ContractBuilderModal } from "../contracts/contract-builder-modal";
import { useToast } from "@/components/ui/toast";
import { hasContractsAccess } from "@/lib/subscription";

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal: number;
  created_at: string;
  couple: { id: string; name: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  subtotal: number;
  due_date: string | null;
  created_at: string;
  couple: { id: string; name: string };
}

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  signed_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
}

const CONTRACT_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  signed: "bg-emerald-50 text-emerald-600",
  declined: "bg-red-50 text-red-600",
  expired: "bg-gray-100 text-gray-500",
  revoked: "bg-gray-100 text-gray-500",
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  accepted: "bg-emerald-50 text-emerald-600",
  declined: "bg-red-50 text-red-600",
  expired: "bg-gray-100 text-gray-500",
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  deposit_paid: "bg-amber-50 text-amber-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-400",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  deposit_paid: "Deposit Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export default function PaymentsPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"quotes" | "invoices" | "contracts">("quotes");
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activeContract, setActiveContract] = useState<{ id: string; coupleId: string; coupleName: string } | null>(null);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [contractSearch, setContractSearch] = useState("");
  const [newContractOpen, setNewContractOpen] = useState(false);
  const [newContractFilter, setNewContractFilter] = useState("");
  const [contractsEnabled, setContractsEnabled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setContractsEnabled(hasContractsAccess(data.user?.user_metadata));
    });
    return () => { cancelled = true };
  }, [supabase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setQuoteSearch("");
        setInvoiceSearch("");
        setContractSearch("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!contractsEnabled && activeTab === "contracts") setActiveTab("quotes");
  }, [contractsEnabled, activeTab]);

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["all-quotes"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quotes")
        .select(
          "id, quote_number, title, status, subtotal, created_at, couple:couple_id(id, name)"
        )
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as Quote[]) || [];
    },
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["all-contracts"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id, contract_number, title, status, signed_at, created_at, couple:couple_id(id, name)"
        )
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Contract[]) || [];
    },
  });

  const { data: coupleOptions } = useQuery({
    queryKey: ["all-couples-for-new-contract"],
    enabled: newContractOpen,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("couples")
        .select("id, name")
        .eq("user_id", user.user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as { id: string; name: string }[]) || [];
    },
  });

  const createContractForCouple = async (coupleId: string, coupleName: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: num, error: numErr } = await supabase.rpc("generate_contract_number", {
      p_user_id: user.user.id,
    });
    if (numErr) {
      toast("Failed to create contract", "error");
      return;
    }
    const { data, error } = await supabase
      .from("contracts")
      .insert({
        user_id: user.user.id,
        couple_id: coupleId,
        title: `Contract for ${coupleName}`,
        contract_number: num as string,
        status: "draft",
        content: { type: "doc", content: [{ type: "paragraph" }] },
      })
      .select("id")
      .single();
    if (error || !data) {
      toast("Failed to create contract", "error");
      return;
    }
    setNewContractOpen(false);
    setNewContractFilter("");
    setActiveContract({ id: data.id, coupleId, coupleName });
  };

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["all-invoices"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, title, status, subtotal, due_date, created_at, couple:couple_id(id, name)"
        )
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as Invoice[]) || [];
    },
  });

  const filteredQuotes = (quotes || []).filter((q) => {
    if (!quoteSearch) return true;
    const s = quoteSearch.toLowerCase();
    return (
      q.title.toLowerCase().includes(s) ||
      q.quote_number.toLowerCase().includes(s) ||
      q.couple.name.toLowerCase().includes(s) ||
      q.status.toLowerCase().includes(s)
    );
  });

  const filteredInvoices = (invoices || [])
    .map((inv) => {
      const isOverdue =
        inv.due_date &&
        new Date(inv.due_date + "T00:00:00") < new Date() &&
        !["paid", "cancelled"].includes(inv.status);
      return {
        ...inv,
        effectiveStatus: isOverdue ? "overdue" : inv.status,
        isOverdue,
      };
    })
    .filter((inv) => {
      if (!invoiceSearch) return true;
      const s = invoiceSearch.toLowerCase();
      return (
        inv.title.toLowerCase().includes(s) ||
        inv.invoice_number.toLowerCase().includes(s) ||
        inv.couple.name.toLowerCase().includes(s) ||
        inv.status.toLowerCase().includes(s)
      );
    });

  const filteredContracts = (contracts || []).filter((c) => {
    if (!contractSearch) return true;
    const s = contractSearch.toLowerCase();
    return (
      c.title.toLowerCase().includes(s) ||
      c.contract_number.toLowerCase().includes(s) ||
      c.couple.name.toLowerCase().includes(s) ||
      c.status.toLowerCase().includes(s)
    );
  });

  const isLoading =
    activeTab === "quotes" ? quotesLoading :
    activeTab === "invoices" ? invoicesLoading :
    contractsLoading;

  const mobileTotal =
    activeTab === "quotes"
      ? filteredQuotes.reduce((sum, q) => sum + q.subtotal, 0)
      : activeTab === "invoices"
      ? filteredInvoices.reduce((sum, inv) => sum + inv.subtotal, 0)
      : 0;

  const mobileCount =
    activeTab === "quotes"
      ? filteredQuotes.length
      : activeTab === "invoices"
      ? filteredInvoices.length
      : filteredContracts.length;

  const handleNew = () => {
    if (activeTab === "quotes") setActiveQuoteId("new");
    else if (activeTab === "invoices") setActiveInvoiceId("new");
    else setNewContractOpen(true);
  };

  const currentSearch =
    activeTab === "quotes" ? quoteSearch :
    activeTab === "invoices" ? invoiceSearch :
    contractSearch;
  const setCurrentSearch = (v: string) => {
    if (activeTab === "quotes") setQuoteSearch(v);
    else if (activeTab === "invoices") setInvoiceSearch(v);
    else setContractSearch(v);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 sm:px-[3.75rem] pt-6 pb-2 flex-shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-semibold text-gray-900">Payments</h1>
            <span className="text-sm text-gray-400">{mobileCount} total</span>
          </div>
          <Popover.Root
            open={activeTab === "contracts" ? newContractOpen : false}
            onOpenChange={activeTab === "contracts" ? setNewContractOpen : undefined}
          >
            <Popover.Trigger asChild>
              <button
                onClick={handleNew}
                className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer"
                aria-label={`New ${activeTab === "quotes" ? "quote" : activeTab === "invoices" ? "invoice" : "contract"}`}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </Popover.Trigger>
          </Popover.Root>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search
              size={11}
              strokeWidth={1.5}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={currentSearch}
              onChange={(e) => setCurrentSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 transition"
            />
            {currentSearch && (
              <button
                onClick={() => {
                  setCurrentSearch("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer p-0.5"
              >
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* New button - desktop */}
          <div className="ml-auto flex items-center gap-2">
            <Popover.Root
              open={activeTab === "contracts" ? newContractOpen : false}
              onOpenChange={activeTab === "contracts" ? setNewContractOpen : undefined}
            >
              <Popover.Trigger asChild>
                <button
                  onClick={handleNew}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer"
                >
                  <Plus size={11} strokeWidth={2} />
                  New {activeTab === "quotes" ? "quote" : activeTab === "invoices" ? "invoice" : "contract"}
                </button>
              </Popover.Trigger>
              {activeTab === "contracts" && (
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={6}
                    className="z-[90] w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-2 animate-fade-in"
                  >
                    <p className="text-xs font-medium text-gray-500 px-2 py-1">
                      Pick a couple for this contract
                    </p>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search couples…"
                      value={newContractFilter}
                      onChange={(e) => setNewContractFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg mb-1 focus:outline-none focus:border-gray-400"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {(coupleOptions || [])
                        .filter((c) =>
                          !newContractFilter || c.name.toLowerCase().includes(newContractFilter.toLowerCase())
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => createContractForCouple(c.id, c.name)}
                            className="w-full text-left px-2 py-1.5 text-sm text-gray-900 hover:bg-gray-50 rounded-md cursor-pointer"
                          >
                            {c.name}
                          </button>
                        ))}
                      {coupleOptions && coupleOptions.length === 0 && (
                        <p className="text-sm text-gray-400 px-2 py-3 text-center">
                          Create a couple first.
                        </p>
                      )}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              )}
            </Popover.Root>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-gray-200 mt-6">
          <button
            onClick={() => setActiveTab("quotes")}
            className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === "quotes"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <FileText size={15} strokeWidth={1.5} /> Quotes
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              activeTab === "invoices"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Receipt size={15} strokeWidth={1.5} /> Invoices
          </button>
          {contractsEnabled && (
            <button
              onClick={() => setActiveTab("contracts")}
              className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
                activeTab === "contracts"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <FileSignature size={15} strokeWidth={1.5} /> Contracts
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 sm:px-[3.75rem] pb-28">
          {activeTab === "contracts" ? (
            <PaymentsTable
              loading={isLoading}
              emptyIcon={<FileSignature size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
              emptyMessage={contractSearch ? "No contracts match your search." : "No contracts yet. Create one from a couple or the + New button."}
              rows={filteredContracts}
              lastColLabel="Date"
              lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
              valueColLabel="Signed"
              valueColIcon={<Calendar size={12} strokeWidth={1.5} />}
              renderRow={(c) => ({
                key: c.id,
                onClick: () => setActiveContract({ id: c.id, coupleId: c.couple.id, coupleName: c.couple.name }),
                number: c.contract_number,
                title: c.title,
                coupleName: c.couple.name,
                statusPill: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CONTRACT_STATUS_STYLES[c.status] || CONTRACT_STATUS_STYLES.draft}`}>
                    {c.status}
                  </span>
                ),
                valueCell: (
                  <span className="text-sm text-gray-500 group-hover:text-gray-900">
                    {c.signed_at ? new Date(c.signed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : " - "}
                  </span>
                ),
                lastCell: (
                  <span className="text-sm text-gray-500 group-hover:text-gray-900">
                    {new Date(c.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                ),
                mobileSecondary: null,
                mobileValueRight: null,
                mobileStatus: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${CONTRACT_STATUS_STYLES[c.status] || CONTRACT_STATUS_STYLES.draft}`}>
                    {c.status}
                  </span>
                ),
              })}
            />
          ) : activeTab === "quotes" ? (
            <PaymentsTable
              loading={isLoading}
              emptyIcon={<FileText size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
              emptyMessage={quoteSearch ? "No quotes match your search." : "No quotes yet. Create one to get started."}
              rows={filteredQuotes}
              lastColLabel="Date"
              lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
              valueColLabel="Total"
              valueColIcon={<DollarSign size={12} strokeWidth={1.5} />}
              renderRow={(quote) => ({
                key: quote.id,
                onClick: () => setActiveQuoteId(quote.id),
                number: quote.quote_number,
                title: quote.title,
                coupleName: quote.couple.name,
                statusPill: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${QUOTE_STATUS_STYLES[quote.status] || QUOTE_STATUS_STYLES.draft}`}>
                    {quote.status}
                  </span>
                ),
                valueCell: (
                  <span className="text-sm text-gray-500 group-hover:text-gray-900 tabular-nums">
                    {formatCurrency(quote.subtotal)}
                  </span>
                ),
                lastCell: (
                  <span className="text-sm text-gray-500 group-hover:text-gray-900">
                    {new Date(quote.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                ),
                mobileValueRight: (
                  <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
                    {formatCurrency(quote.subtotal)}
                  </span>
                ),
                mobileStatus: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${QUOTE_STATUS_STYLES[quote.status] || QUOTE_STATUS_STYLES.draft}`}>
                    {quote.status}
                  </span>
                ),
                mobileSecondary: null,
              })}
            />
          ) : (
            <PaymentsTable
              loading={isLoading}
              emptyIcon={<Receipt size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
              emptyMessage={invoiceSearch ? "No invoices match your search." : "No invoices yet. Create one to get started."}
              rows={filteredInvoices}
              lastColLabel="Due"
              lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
              valueColLabel="Total"
              valueColIcon={<DollarSign size={12} strokeWidth={1.5} />}
              renderRow={(invoice) => ({
                key: invoice.id,
                onClick: () => setActiveInvoiceId(invoice.id),
                number: invoice.invoice_number,
                title: invoice.title,
                coupleName: invoice.couple.name,
                statusPill: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${INVOICE_STATUS_STYLES[invoice.effectiveStatus] || INVOICE_STATUS_STYLES.draft}`}>
                    {INVOICE_STATUS_LABELS[invoice.effectiveStatus] || invoice.effectiveStatus}
                  </span>
                ),
                valueCell: (
                  <span className="text-sm text-gray-500 group-hover:text-gray-900 tabular-nums">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                ),
                lastCell: (
                  <span className={`text-sm ${invoice.isOverdue ? "text-red-500 font-medium" : "text-gray-500 group-hover:text-gray-900"}`}>
                    {invoice.due_date
                      ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                      : " - "}
                  </span>
                ),
                mobileValueRight: (
                  <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                ),
                mobileStatus: (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${INVOICE_STATUS_STYLES[invoice.effectiveStatus] || INVOICE_STATUS_STYLES.draft}`}>
                    {INVOICE_STATUS_LABELS[invoice.effectiveStatus] || invoice.effectiveStatus}
                  </span>
                ),
                mobileSecondary: invoice.due_date ? (
                  <>
                    <span className="text-gray-300 shrink-0">·</span>
                    <span className={`text-xs shrink-0 ${invoice.isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                  </>
                ) : null,
              })}
            />
          )}
        </div>
      </div>

      {/* Total footer */}
      <div className="fixed bottom-0 left-0 md:left-[68px] right-0 z-30 bg-white border-t border-gray-100 px-6 py-5 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {mobileCount}{" "}
          {activeTab === "quotes"
            ? mobileCount === 1 ? "quote" : "quotes"
            : activeTab === "invoices"
            ? mobileCount === 1 ? "invoice" : "invoices"
            : mobileCount === 1 ? "contract" : "contracts"}
        </p>
        {activeTab !== "contracts" && (
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(mobileTotal)}</p>
        )}
      </div>


      {!!activeQuoteId && (
        <QuoteBuilderModal
          quoteId={activeQuoteId}
          isOpen
          onClose={() => setActiveQuoteId(null)}
          onCreateInvoice={(invId) => {
            setActiveQuoteId(null);
            setActiveInvoiceId(invId);
          }}
        />
      )}

      {!!activeInvoiceId && (
        <InvoiceBuilderModal
          invoiceId={activeInvoiceId}
          isOpen
          onClose={() => setActiveInvoiceId(null)}
        />
      )}

      {!!activeContract && (
        <ContractBuilderModal
          contractId={activeContract.id}
          coupleId={activeContract.coupleId}
          coupleName={activeContract.coupleName}
          isOpen
          onClose={() => setActiveContract(null)}
        />
      )}
    </div>
  );
}

const COL_WIDTHS = {
  number: "11%",
  title: "26%",
  couple: "22%",
  status: "14%",
  value: "13%",
  last: "14%",
} as const;

interface PaymentsRow {
  key: string;
  onClick: () => void;
  number: string;
  title: string;
  coupleName: string;
  statusPill: React.ReactNode;
  valueCell: React.ReactNode;
  lastCell: React.ReactNode;
  mobileValueRight: React.ReactNode;
  mobileStatus: React.ReactNode;
  mobileSecondary: React.ReactNode;
}

interface PaymentsTableProps<T> {
  loading: boolean;
  rows: T[];
  emptyIcon: React.ReactNode;
  emptyMessage: string;
  valueColLabel: string;
  valueColIcon: React.ReactNode;
  lastColLabel: string;
  lastColIcon: React.ReactNode;
  renderRow: (row: T) => PaymentsRow;
}

function HeaderLabel({ icon, label, textOnly }: { icon?: React.ReactNode; label: string; textOnly?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {textOnly ? <span className="text-[11px]">{textOnly}</span> : icon}
      {label}
    </span>
  );
}

function PaymentsTable<T>({
  loading,
  rows,
  emptyIcon,
  emptyMessage,
  valueColLabel,
  valueColIcon,
  lastColLabel,
  lastColIcon,
  renderRow,
}: PaymentsTableProps<T>) {
  if (!loading && rows.length === 0) {
    return (
      <div className="py-16 text-center">
        {emptyIcon}
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  const mapped = rows.map(renderRow);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        {/* Mobile card list */}
        <div className="sm:hidden">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 pr-3">
                    <div className="h-4 bg-gray-100 rounded-md w-36 mb-1.5" />
                    <div className="h-3 bg-gray-100 rounded-md w-24" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
              ))
            : mapped.map((r) => (
                <div
                  key={r.key}
                  onClick={r.onClick}
                  className="flex items-start justify-between gap-3 py-3.5 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-400 shrink-0">{r.number}</span>
                      {r.mobileStatus}
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-sm text-gray-900 truncate">{r.title}</span>
                      <span className="text-gray-300 shrink-0">·</span>
                      <span className="text-sm text-gray-500 truncate shrink-0 max-w-[140px]">{r.coupleName}</span>
                      {r.mobileSecondary}
                    </div>
                  </div>
                  {r.mobileValueRight}
                </div>
              ))}
        </div>

        {/* Desktop table */}
        <table className="hidden sm:table w-full table-fixed border-separate border-spacing-0 min-w-[600px] md:max-w-[1800px]">
          <thead className="sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
            <tr>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.number }}>
                <HeaderLabel icon={<Hash size={12} strokeWidth={1.5} />} label="Number" />
              </th>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.title }}>
                <HeaderLabel textOnly="Aa" label="Title" />
              </th>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.couple }}>
                <HeaderLabel icon={<Users size={12} strokeWidth={1.5} />} label="Couple" />
              </th>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.status }}>
                <HeaderLabel icon={<ListChecks size={12} strokeWidth={1.5} />} label="Status" />
              </th>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.value }}>
                <HeaderLabel icon={valueColIcon} label={valueColLabel} />
              </th>
              <th className="pl-0 pr-2 py-1.5 text-left text-xs font-normal text-gray-400" style={{ width: COL_WIDTHS.last }}>
                <HeaderLabel icon={lastColIcon} label={lastColLabel} />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <td key={j} className="pl-0 pr-2 py-2 border-b border-gray-100">
                        <div className="h-4 bg-gray-100 rounded-md w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : mapped.map((r, idx) => {
                  const isLast = idx === mapped.length - 1;
                  const borderClass = isLast ? "" : "border-b border-gray-100";
                  return (
                    <tr
                      key={r.key}
                      onClick={r.onClick}
                      className="cursor-pointer transition group hover:bg-gray-50/60"
                    >
                      <td className={`pl-0 pr-2 py-2 text-sm overflow-hidden ${borderClass}`} style={{ width: COL_WIDTHS.number }}>
                        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">{r.number}</span>
                      </td>
                      <td className={`pl-0 pr-2 py-2 text-sm overflow-hidden ${borderClass}`} style={{ width: COL_WIDTHS.title }}>
                        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">{r.title}</span>
                      </td>
                      <td className={`pl-0 pr-2 py-2 text-sm overflow-hidden ${borderClass}`} style={{ width: COL_WIDTHS.couple }}>
                        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">{r.coupleName}</span>
                      </td>
                      <td className={`pl-0 pr-2 py-2 text-sm ${borderClass}`} style={{ width: COL_WIDTHS.status }}>
                        {r.statusPill}
                      </td>
                      <td className={`pl-0 pr-2 py-2 text-sm overflow-hidden ${borderClass}`} style={{ width: COL_WIDTHS.value }}>
                        {r.valueCell}
                      </td>
                      <td className={`pl-0 pr-3 py-2 text-sm overflow-hidden ${borderClass}`} style={{ width: COL_WIDTHS.last }}>
                        {r.lastCell}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
