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
import { Users } from "lucide-react";
import { Couple } from "./couples-types";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface CouplesListProps {
  couples: Couple[];
  onRowClick: (couple: Couple) => void;
  loading: boolean;
}

const columnHelper = createColumnHelper<Couple>();

// Column width percentages (total = 100%)
const COL_WIDTHS: Record<string, string> = {
  name: "20%",
  email: "22%",
  phone: "14%",
  event_date: "14%",
  venue: "18%",
  status: "12%",
};

const columns = [
  columnHelper.accessor("name", {
    header: "Name",
    enableSorting: false,
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
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
  columnHelper.accessor("phone", {
    header: "Phone",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("event_date", {
    header: "Event date",
    enableSorting: false,
    cell: (info) => (
      <span className="text-gray-600">{formatDate(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor("venue", {
    header: "Venue",
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500 truncate block">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: (info) => (
      <Badge variant={info.getValue() as any}>
        {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
      </Badge>
    ),
  }),
];

const skeletonWidths = ["w-32", "w-40", "w-24", "w-20", "w-28", "w-16"];

export function CouplesList({
  couples,
  onRowClick,
  loading,
}: CouplesListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 });
  }, [couples]);

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
        <Users size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No couples yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start by adding your first couple.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="overflow-y-auto flex-1">
        <table className="w-full table-fixed max-w-6xl">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className="py-3 text-left text-xs font-medium text-gray-500"
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
                      <td key={j} className="py-3.5">
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
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="py-3.5 text-sm overflow-hidden"
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
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}
            –
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              couples.length
            )}{" "}
            of {couples.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              {table.getState().pagination.pageIndex + 1} /{" "}
              {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
