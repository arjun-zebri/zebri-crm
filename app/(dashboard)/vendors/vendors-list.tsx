"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect, useRef } from "react";
import {
  Store,
  Phone,
  Mail,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Vendor, CATEGORY_LABELS } from "./vendors-types";
import { Badge } from "@/components/ui/badge";

interface VendorsListProps {
  vendors: Vendor[];
  onRowClick: (vendor: Vendor) => void;
  loading: boolean;
}

const columnHelper = createColumnHelper<Vendor>();

const COL_WIDTHS: Record<string, string> = {
  name: "22%",
  contact_name: "18%",
  phone: "14%",
  email: "20%",
  category: "14%",
  status: "12%",
};

const columns = [
  columnHelper.accessor("name", {
    header: "Vendor name",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("contact_name", {
    header: "Contact",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("phone", {
    header: "Phone",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("email", {
    header: "Email",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500 truncate block">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("category", {
    header: "Category",
    enableSorting: false,
    cell: (info) => (
      <Badge variant={info.getValue() as any}>
        {CATEGORY_LABELS[info.getValue()]}
      </Badge>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: (info) => (
      <div className="flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            info.getValue() === "active" ? "bg-emerald-400" : "bg-gray-300"
          }`}
        />
        <span className="text-sm text-gray-500">
          {info.getValue() === "active" ? "Active" : "Inactive"}
        </span>
      </div>
    ),
  }),
];

const skeletonWidths = ["w-32", "w-28", "w-24", "w-40", "w-24", "w-16"];

export function VendorsList({
  vendors,
  onRowClick,
  loading,
}: VendorsListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 });
  }, [vendors]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(e.target as Node)) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const table = useReactTable({
    data: vendors,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  if (vendors.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Store size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No vendors yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start building your vendor network.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full table-fixed max-w-[1800px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-sm font-medium text-gray-900"
                  style={{ width: COL_WIDTHS[header.id] }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="animate-pulse border-b border-gray-100 last:border-0"
                  >
                    {columns.map((_, j) => (
                      <td key={j} className="px-6 py-3.5">
                        <div
                          className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => {
                  const v = row.original;
                  const hasPhone = !!v.phone;
                  const hasEmail = !!v.email;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(v)}
                      className="border-b border-gray-100 last:border-0 cursor-pointer transition hover:bg-gray-50 group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-6 py-3.5 text-sm overflow-hidden"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                      {/* Row hover actions — positioned over the last cell */}
                      <td className="p-0 w-0 overflow-visible">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition bg-gray-50 rounded-lg px-1 py-0.5">
                          <a
                            href={hasPhone ? `tel:${v.phone}` : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasPhone) e.preventDefault();
                            }}
                            title={
                              hasPhone ? `Call ${v.phone}` : "No phone number"
                            }
                            className={`p-1.5 rounded transition ${
                              hasPhone
                                ? "text-gray-500 hover:text-gray-900 hover:bg-white"
                                : "text-gray-200 cursor-not-allowed"
                            }`}
                          >
                            <Phone size={15} />
                          </a>
                          <a
                            href={hasEmail ? `mailto:${v.email}` : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasEmail) e.preventDefault();
                            }}
                            title={hasEmail ? `Email ${v.email}` : "No email"}
                            className={`p-1.5 rounded transition ${
                              hasEmail
                                ? "text-gray-500 hover:text-gray-900 hover:bg-white"
                                : "text-gray-200 cursor-not-allowed"
                            }`}
                          >
                            <Mail size={15} />
                          </a>
                          <a
                            href={
                              hasPhone
                                ? `https://wa.me/${v.phone.replace(/\D/g, "")}`
                                : undefined
                            }
                            target={hasPhone ? "_blank" : undefined}
                            rel={hasPhone ? "noopener noreferrer" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasPhone) e.preventDefault();
                            }}
                            title={
                              hasPhone
                                ? `WhatsApp ${v.phone}`
                                : "No phone number"
                            }
                            className={`p-1.5 rounded transition ${
                              hasPhone
                                ? "text-gray-500 hover:text-gray-900 hover:bg-white"
                                : "text-gray-200 cursor-not-allowed"
                            }`}
                          >
                            <MessageCircle size={15} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-3.5 flex justify-end relative">
        <div className="flex items-center gap-3">
          {table.getPageCount() > 1 && (
            <>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: table.getPageCount() }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => table.setPageIndex(i)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                      table.getState().pagination.pageIndex === i
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>

              <div className="h-5 w-px bg-gray-200" />
            </>
          )}

          <div ref={pageSizeRef}>
            <button
              onClick={() => setPageSizeOpen(!pageSizeOpen)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-600 hover:border-gray-300 cursor-pointer transition"
            >
              {table.getState().pagination.pageSize}/page
            </button>
            {pageSizeOpen && (
              <div className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                style={{
                  bottom: window.innerHeight - (pageSizeRef.current?.getBoundingClientRect().top || 0) + 8,
                  right: window.innerWidth - (pageSizeRef.current?.getBoundingClientRect().right || 0),
                  width: pageSizeRef.current?.getBoundingClientRect().width,
                }}>
                {[10, 25, 50].map((pageSize) => (
                  <button
                    key={pageSize}
                    onClick={() => {
                      table.setPageSize(pageSize);
                      setPageSizeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      table.getState().pagination.pageSize === pageSize
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageSize}/page
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
