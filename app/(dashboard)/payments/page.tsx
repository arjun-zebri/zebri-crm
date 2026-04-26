"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { FileText, FileSignature, Receipt, Search, X, Plus } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setContractsEnabled(hasContractsAccess(data.user?.user_metadata));
    });
    return () => { cancelled = true };
  }, [supabase]);

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
      <div className="px-4 sm:px-6 pt-6 pb-2 flex-shrink-0">
        {/* Header — matches couples/contacts pattern */}
        <div className="flex items-center flex-wrap gap-x-1 gap-y-3 mb-6">
          {/* Title */}
          <div className="flex items-baseline gap-3 flex-none sm:order-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Payments</h1>
            <span className="text-sm text-gray-400">{mobileCount} total</span>
          </div>

          {/* Desktop spacer */}
          <div className="hidden sm:block sm:flex-1 sm:order-2" />

          {/* Search — full-width below on mobile */}
          <div className="relative order-last w-full sm:order-3 sm:w-auto sm:mr-1">
            <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={currentSearch}
              onChange={(e) => setCurrentSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200"
            />
            {currentSearch && (
              <button
                onClick={() => setCurrentSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* New button */}
          <div className="flex items-center ml-auto sm:ml-0 sm:order-4">
            <Popover.Root
              open={activeTab === "contracts" ? newContractOpen : false}
              onOpenChange={activeTab === "contracts" ? setNewContractOpen : undefined}
            >
              <Popover.Trigger asChild>
                <button
                  onClick={handleNew}
                  className="sm:hidden p-1 text-gray-600 hover:text-gray-900 active:scale-95 transition cursor-pointer"
                >
                  <Plus size={20} strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Trigger asChild>
                <button
                  onClick={handleNew}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-xl hover:bg-neutral-800 transition ml-1 cursor-pointer"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  New
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
        <div className="flex items-center gap-6 border-b border-gray-200">
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
        <div className="px-4 sm:px-6 pb-28">
          <div>
            {activeTab === "contracts" ? (
              <>
                <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 sticky top-0 bg-white [box-shadow:0_1px_0_rgb(229,231,235)]">
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Number</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Title</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Couple</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Status</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Signed</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Date</div>
                </div>
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileSignature size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      {contractSearch ? "No contracts match your search." : "No contracts yet. Create one from a couple or the + New button."}
                    </p>
                  </div>
                ) : (
                  filteredContracts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveContract({ id: c.id, coupleId: c.couple.id, coupleName: c.couple.name })}
                      className="w-full text-left border-b border-gray-100 hover:bg-gray-50 transition last:border-b-0 cursor-pointer group"
                    >
                      <div className="sm:hidden px-2 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-gray-400 shrink-0">{c.contract_number}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${CONTRACT_STATUS_STYLES[c.status] || CONTRACT_STATUS_STYLES.draft}`}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm text-gray-900 truncate">{c.title}</span>
                          <span className="text-gray-300 shrink-0">·</span>
                          <span className="text-sm text-gray-500 truncate shrink-0 max-w-[120px]">{c.couple.name}</span>
                        </div>
                      </div>
                      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0">
                        <div className="px-4 py-3.5 text-sm font-medium text-gray-500 group-hover:text-gray-900 whitespace-nowrap">{c.contract_number}</div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">{c.title}</div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">{c.couple.name}</div>
                        <div className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CONTRACT_STATUS_STYLES[c.status] || CONTRACT_STATUS_STYLES.draft}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 text-right whitespace-nowrap">
                          {c.signed_at ? new Date(c.signed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-700 text-right whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </>
            ) : activeTab === "quotes" ? (
              <>
                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 sticky top-0 bg-white [box-shadow:0_1px_0_rgb(229,231,235)]">
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Number</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Title</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Couple</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Status</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Total</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Date</div>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredQuotes.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileText size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      {quoteSearch ? "No quotes match your search." : "No quotes yet. Create one to get started."}
                    </p>
                  </div>
                ) : (
                  filteredQuotes.map((quote) => (
                    <button
                      key={quote.id}
                      onClick={() => setActiveQuoteId(quote.id)}
                      className="w-full text-left border-b border-gray-100 hover:bg-gray-50 transition last:border-b-0 cursor-pointer group"
                    >
                      {/* Mobile card */}
                      <div className="sm:hidden px-2 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-gray-400 shrink-0">{quote.quote_number}</span>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${
                                QUOTE_STATUS_STYLES[quote.status] || QUOTE_STATUS_STYLES.draft
                              }`}
                            >
                              {quote.status}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
                            {formatCurrency(quote.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm text-gray-900 truncate">{quote.title}</span>
                          <span className="text-gray-300 shrink-0">·</span>
                          <span className="text-sm text-gray-500 truncate shrink-0 max-w-[120px]">{quote.couple.name}</span>
                        </div>
                      </div>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0">
                        <div className="px-4 py-3.5 text-sm font-medium text-gray-500 group-hover:text-gray-900 whitespace-nowrap">
                          {quote.quote_number}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">
                          {quote.title}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">
                          {quote.couple.name}
                        </div>
                        <div className="px-4 py-3.5">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                              QUOTE_STATUS_STYLES[quote.status] || QUOTE_STATUS_STYLES.draft
                            }`}
                          >
                            {quote.status}
                          </span>
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-700 font-medium tabular-nums text-right">
                          {formatCurrency(quote.subtotal)}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-700 text-right whitespace-nowrap">
                          {new Date(quote.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 sticky top-0 bg-white [box-shadow:0_1px_0_rgb(229,231,235)]">
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Number</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Title</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Couple</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">Status</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Total</div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">Due</div>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="py-16 text-center">
                    <Receipt size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">
                      {invoiceSearch ? "No invoices match your search." : "No invoices yet. Create one to get started."}
                    </p>
                  </div>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      onClick={() => setActiveInvoiceId(invoice.id)}
                      className="w-full text-left border-b border-gray-100 hover:bg-gray-50 transition last:border-b-0 cursor-pointer group"
                    >
                      {/* Mobile card */}
                      <div className="sm:hidden px-2 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-gray-400 shrink-0">{invoice.invoice_number}</span>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                                INVOICE_STATUS_STYLES[invoice.effectiveStatus] || INVOICE_STATUS_STYLES.draft
                              }`}
                            >
                              {INVOICE_STATUS_LABELS[invoice.effectiveStatus] || invoice.effectiveStatus}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 tabular-nums shrink-0">
                            {formatCurrency(invoice.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm text-gray-900 truncate">{invoice.title}</span>
                          <span className="text-gray-300 shrink-0">·</span>
                          <span className="text-sm text-gray-500 truncate shrink-0 max-w-[120px]">{invoice.couple.name}</span>
                          {invoice.due_date && (
                            <>
                              <span className="text-gray-300 shrink-0">·</span>
                              <span className={`text-xs shrink-0 ${invoice.isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                                {new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0">
                        <div className="px-4 py-3.5 text-sm font-medium text-gray-500 group-hover:text-gray-900 whitespace-nowrap">
                          {invoice.invoice_number}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">
                          {invoice.title}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-900 truncate min-w-0">
                          {invoice.couple.name}
                        </div>
                        <div className="px-4 py-3.5">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              INVOICE_STATUS_STYLES[invoice.effectiveStatus] || INVOICE_STATUS_STYLES.draft
                            }`}
                          >
                            {INVOICE_STATUS_LABELS[invoice.effectiveStatus] || invoice.effectiveStatus}
                          </span>
                        </div>
                        <div className="px-4 py-3.5 text-sm text-gray-700 font-medium tabular-nums text-right">
                          {formatCurrency(invoice.subtotal)}
                        </div>
                        <div
                          className={`px-4 py-3.5 text-sm text-right whitespace-nowrap ${
                            invoice.isOverdue ? "text-red-500 font-medium" : "text-gray-500 group-hover:text-gray-700"
                          }`}
                        >
                          {invoice.due_date
                            ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                            : "—"}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </>
            )}
          </div>

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
