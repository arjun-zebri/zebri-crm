"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { FileText, Receipt, Search, X, Plus } from "lucide-react";
import { QuoteBuilderModal } from "../quotes/quote-builder-modal";
import { InvoiceBuilderModal } from "../invoices/invoice-builder-modal";

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
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-400",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

export default function PaymentsPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"quotes" | "invoices">("quotes");
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

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

  const isLoading = activeTab === "quotes" ? quotesLoading : invoicesLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Payments</h1>
          <div className="flex items-center gap-1">
            <div className="relative mr-1">
              <Search
                size={15}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search..."
                value={activeTab === "quotes" ? quoteSearch : invoiceSearch}
                onChange={(e) =>
                  activeTab === "quotes"
                    ? setQuoteSearch(e.target.value)
                    : setInvoiceSearch(e.target.value)
                }
                className="w-36 sm:w-56 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              {(activeTab === "quotes" ? quoteSearch : invoiceSearch) && (
                <button
                  onClick={() => {
                    if (activeTab === "quotes") {
                      setQuoteSearch("");
                    } else {
                      setInvoiceSearch("");
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                if (activeTab === "quotes") {
                  setActiveQuoteId("new");
                } else {
                  setActiveInvoiceId("new");
                }
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-black rounded-xl hover:bg-neutral-800 transition ml-1 cursor-pointer"
            >
              <Plus size={14} strokeWidth={1.5} />
              New
            </button>
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
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pb-6">
          {/* Table */}
          <div>
            {activeTab === "quotes" ? (
              <>
                <div className="grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 sticky top-0 bg-white [box-shadow:0_1px_0_rgb(229,231,235)]">
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Number
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Title
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Couple
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Status
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">
                    Total
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">
                    Date
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 bg-gray-100 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredQuotes.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileText
                      size={32}
                      strokeWidth={1}
                      className="text-gray-200 mx-auto mb-3"
                    />
                    <p className="text-sm text-gray-400">
                      {quoteSearch
                        ? "No quotes match your search."
                        : "No quotes yet. Create one to get started."}
                    </p>
                  </div>
                ) : (
                  filteredQuotes.map((quote) => (
                    <button
                      key={quote.id}
                      onClick={() => setActiveQuoteId(quote.id)}
                      className="w-full grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 border-b border-gray-100 hover:bg-gray-50 transition text-left last:border-b-0 cursor-pointer group"
                    >
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
                            QUOTE_STATUS_STYLES[quote.status] ||
                            QUOTE_STATUS_STYLES.draft
                          }`}
                        >
                          {quote.status}
                        </span>
                      </div>
                      <div className="px-4 py-3.5 text-sm text-gray-700 font-medium tabular-nums text-right">
                        {formatCurrency(quote.subtotal)}
                      </div>
                      <div className="px-4 py-3.5 text-sm text-gray-500 group-hover:text-gray-700 text-right whitespace-nowrap">
                        {new Date(quote.created_at).toLocaleDateString(
                          "en-AU",
                          {
                            day: "numeric",
                            month: "short",
                          }
                        )}
                      </div>
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 sticky top-0 bg-white [box-shadow:0_1px_0_rgb(229,231,235)]">
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Number
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Title
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Couple
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900">
                    Status
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">
                    Total
                  </div>
                  <div className="px-4 py-3.5 text-sm font-medium text-gray-900 text-right">
                    Due
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 bg-gray-100 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="py-16 text-center">
                    <Receipt
                      size={32}
                      strokeWidth={1}
                      className="text-gray-200 mx-auto mb-3"
                    />
                    <p className="text-sm text-gray-400">
                      {invoiceSearch
                        ? "No invoices match your search."
                        : "No invoices yet. Create one to get started."}
                    </p>
                  </div>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      onClick={() => setActiveInvoiceId(invoice.id)}
                      className="w-full grid grid-cols-[auto_1fr_1fr_120px_100px_100px] gap-0 border-b border-gray-100 hover:bg-gray-50 transition text-left last:border-b-0 cursor-pointer group"
                    >
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
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            INVOICE_STATUS_STYLES[invoice.effectiveStatus] ||
                            INVOICE_STATUS_STYLES.draft
                          }`}
                        >
                          {invoice.effectiveStatus}
                        </span>
                      </div>
                      <div className="px-4 py-3.5 text-sm text-gray-700 font-medium tabular-nums text-right">
                        {formatCurrency(invoice.subtotal)}
                      </div>
                      <div
                        className={`px-4 py-3.5 text-sm text-right whitespace-nowrap ${
                          invoice.isOverdue
                            ? "text-red-500 font-medium"
                            : "text-gray-500 group-hover:text-gray-700"
                        }`}
                      >
                        {invoice.due_date
                          ? new Date(
                              invoice.due_date + "T00:00:00"
                            ).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </div>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <QuoteBuilderModal
        quoteId={activeQuoteId}
        isOpen={!!activeQuoteId}
        onClose={() => setActiveQuoteId(null)}
        onCreateInvoice={(invId) => {
          setActiveQuoteId(null);
          setActiveInvoiceId(invId);
        }}
      />

      <InvoiceBuilderModal
        invoiceId={activeInvoiceId}
        isOpen={!!activeInvoiceId}
        onClose={() => setActiveInvoiceId(null)}
      />
    </div>
  );
}
