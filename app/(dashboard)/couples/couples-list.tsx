"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Couple, CoupleStatusRecord, getStatusClasses } from "./couples-types";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface CouplesListProps {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  onRowClick: (couple: Couple) => void;
  loading: boolean;
}

const columnHelper = createColumnHelper<Couple>();

// Column width percentages (total = 100%)
const COL_WIDTHS: Record<string, string> = {
  name: "22%",
  email: "24%",
  phone: "14%",
  event_date: "12%",
  venue: "18%",
  status: "10%",
};

function createColumns(statuses: CoupleStatusRecord[]) {
  return [
    columnHelper.accessor("name", {
      header: "Name",
      enableSorting: false,
      cell: (info) => (
        <span className="text-sm text-gray-500">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      enableSorting: false,
      meta: { hidden: "hidden sm:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("phone", {
      header: "Phone",
      enableSorting: false,
      meta: { hidden: "hidden lg:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("event_date", {
      header: "Event date",
      enableSorting: false,
      meta: { hidden: "hidden sm:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500">{formatDate(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("venue", {
      header: "Venue",
      enableSorting: false,
      meta: { hidden: "hidden lg:table-cell" },
      cell: (info) => (
        <span className="text-sm text-gray-500 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      enableSorting: false,
      cell: (info) => {
        const statusSlug = info.getValue();
        const status = statuses.find(s => s.slug === statusSlug);
        const classes = status ? getStatusClasses(status.color) : getStatusClasses('gray');
        const statusName = status?.name || statusSlug.charAt(0).toUpperCase() + statusSlug.slice(1);
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${classes.pill}`}>
            {statusName}
          </span>
        );
      },
    }),
  ];
}

const skeletonWidths = ["w-32", "w-40", "w-24", "w-20", "w-28", "w-16"];

export function CouplesList({
  couples,
  statuses,
  onRowClick,
  loading,
}: CouplesListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);
  const columns = createColumns(statuses);

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 });
  }, [couples]);

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
    data: couples,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (couples.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users size={40} strokeWidth={1.5} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No couples yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start by adding your first couple.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <table className="w-full table-fixed min-w-[400px] md:max-w-[1800px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-3 md:px-6 py-3 text-left text-sm font-medium text-gray-900 ${(header.column.columnDef.meta as any)?.hidden || ""}`}
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
                      <td key={j} className="px-3 md:px-6 py-3.5">
                        <div
                          className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.original)}
                    className="border-b border-gray-100 last:border-0 cursor-pointer transition hover:bg-gray-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-3 md:px-6 py-3.5 text-sm overflow-hidden ${(cell.column.columnDef.meta as any)?.hidden || ""}`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
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
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: table.getPageCount() }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => table.setPageIndex(i)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                      table.getState().pagination.pageIndex === i
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
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
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>

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
              <div className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
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
