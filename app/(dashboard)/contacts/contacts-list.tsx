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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Contact, CATEGORY_LABELS } from "./contacts-types";
import { Badge } from "@/components/ui/badge";

interface ContactsListProps {
  vendors: Contact[];
  onRowClick: (contact: Contact) => void;
  loading: boolean;
}

const columnHelper = createColumnHelper<Contact>();

const COL_WIDTHS: Record<string, string> = {
  name: "25%",
  contact_name: "20%",
  phone: "16%",
  email: "22%",
  category: "17%",
};

const columns = [
  columnHelper.accessor("name", {
    header: "Contact name",
    enableSorting: false,
    cell: (info) => {
      const category = info.row.original.category;
      return (
        <div>
          <span className="text-sm text-gray-500 group-hover:text-gray-900">{info.getValue()}</span>
          <div className="mt-0.5 md:hidden">
            <Badge variant={category as any}>{CATEGORY_LABELS[category]}</Badge>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("contact_name", {
    header: "Contact",
    enableSorting: false,
    meta: { hidden: "hidden md:table-cell" },
    cell: (info) => (
      <span className="text-sm text-gray-500 group-hover:text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("phone", {
    header: "Phone",
    enableSorting: false,
    meta: { hidden: "hidden md:table-cell" },
    cell: (info) => (
      <span className="text-sm text-gray-500 group-hover:text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("email", {
    header: "Email",
    enableSorting: false,
    meta: { hidden: "hidden md:table-cell" },
    cell: (info) => (
      <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("category", {
    header: "Category",
    enableSorting: false,
    meta: { hidden: "hidden md:table-cell" },
    cell: (info) => (
      <Badge variant={info.getValue() as any}>
        {CATEGORY_LABELS[info.getValue()]}
      </Badge>
    ),
  }),
];

const skeletonWidths = ["w-32", "w-28", "w-24", "w-40", "w-24"];

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i);

  const windowSize = 4;
  let windowStart = Math.max(0, currentPage - 3);
  windowStart = Math.min(totalPages - windowSize, windowStart);

  return Array.from({ length: windowSize }, (_, i) => windowStart + i);
}

export function ContactsList({
  vendors,
  onRowClick,
  loading,
}: ContactsListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 25 });
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
    state: { pagination },
    onPaginationChange: setPagination,
  });

  if (vendors.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Store size={40} className="text-gray-300 mb-3" strokeWidth={1.5} />
        <p className="text-gray-600 font-medium mb-2">No contacts yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start building your contact network.
        </p>
      </div>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <table className="w-full table-fixed min-w-[400px] md:max-w-[1800px]">
          <thead className="sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]">
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-0 py-3 text-left text-sm font-medium text-gray-900 ${(header.column.columnDef.meta as any)?.hidden || ""}`}
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
                      <td key={j} className="px-0 py-4 md:py-3.5">
                        <div
                          className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => {
                  const v = row.original;
                  const inactive = v.status === "inactive";
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(v)}
                      className={`border-b border-gray-100 last:border-0 cursor-pointer transition group ${
                        inactive ? "opacity-50" : ""
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-0 py-4 md:py-3.5 text-sm overflow-hidden ${(cell.column.columnDef.meta as any)?.hidden || ""}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-3.5 flex justify-end relative">
        {/* Mobile pagination */}
        {pageCount > 1 && (
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="text-xs text-gray-600">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Desktop pagination */}
        <div className="hidden md:flex items-center gap-3">
          {pageCount > 1 && (
            <>
              <div className="flex items-center w-[280px]">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600 shrink-0"
                  title="Previous page"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>

                <div className="flex flex-1 items-center justify-center gap-1">
                  {getPageNumbers(pageIndex, pageCount).map((pageNum, idx) => (
                    <button
                      key={idx}
                      onClick={() => table.setPageIndex(pageNum)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                        pageIndex === pageNum
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                  {(() => {
                    const pages = getPageNumbers(pageIndex, pageCount);
                    const lastPage = pageCount - 1;
                    if (pages[pages.length - 1] >= lastPage) return null;
                    const adjacent = pages[pages.length - 1] === lastPage - 1;
                    return (
                      <>
                        {!adjacent && <span className="px-1 text-xs text-gray-400">…</span>}
                        <button
                          onClick={() => table.setPageIndex(lastPage)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                            pageIndex === lastPage
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {lastPage + 1}
                        </button>
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition rounded text-gray-600 shrink-0"
                  title="Next page"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="h-5 w-px bg-gray-200" />
            </>
          )}

          <div ref={pageSizeRef}>
            <button
              onClick={() => setPageSizeOpen(!pageSizeOpen)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-600 hover:border-gray-300 cursor-pointer transition"
            >
              {table.getState().pagination.pageSize}/page
            </button>
            {pageSizeOpen && (
              <div
                className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
                style={{
                  bottom: window.innerHeight - (pageSizeRef.current?.getBoundingClientRect().top || 0) + 8,
                  right: window.innerWidth - (pageSizeRef.current?.getBoundingClientRect().right || 0),
                  width: pageSizeRef.current?.getBoundingClientRect().width,
                }}
              >
                {[10, 25, 50].map((pageSize) => (
                  <button
                    key={pageSize}
                    onClick={() => {
                      table.setPageSize(pageSize);
                      setPageSizeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      table.getState().pagination.pageSize === pageSize
                        ? "bg-gray-50 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
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
