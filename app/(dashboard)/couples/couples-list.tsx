'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  PaginationState,
  useReactTable,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { Couple } from './couples-types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface CouplesListProps {
  couples: Couple[]
  onRowClick: (couple: Couple) => void
  loading: boolean
}

const columnHelper = createColumnHelper<Couple>()

const columns = [
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    enableSorting: false,
    cell: (info) => <span className="text-xs text-gray-500">{info.getValue()}</span>,
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    enableSorting: false,
    cell: (info) => <span className="text-xs text-gray-500">{info.getValue()}</span>,
  }),
  columnHelper.accessor('event_date', {
    header: 'Event Date',
    cell: (info) => <span className="text-gray-600">{formatDate(info.getValue())}</span>,
  }),
  columnHelper.accessor('venue', {
    header: 'Venue',
    enableSorting: false,
    cell: (info) => <span className="text-xs text-gray-500">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <Badge variant={info.getValue() as any}>
        {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
      </Badge>
    ),
  }),
]

function SortIcon({ column }: { column: any }) {
  if (!column.getCanSort()) return null
  const isSorted = column.getIsSorted()
  if (isSorted === 'asc') return <ChevronUp size={14} className="text-gray-900" />
  if (isSorted === 'desc') return <ChevronDown size={14} className="text-gray-900" />
  return <ChevronsUpDown size={14} className="text-gray-400" />
}

const skeletonWidths = ['w-32', 'w-40', 'w-24', 'w-20', 'w-28', 'w-16']

export function CouplesList({ couples, onRowClick, loading }: CouplesListProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 })
  }, [couples])

  const table = useReactTable({
    data: couples,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (couples.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No couples yet.</p>
        <p className="text-sm text-gray-500 mb-4">Start by adding your first couple.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50">
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <th
                key={header.id}
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-900"
              >
                {header.column.getCanSort() ? (
                  <button
                    onClick={() => header.column.toggleSorting()}
                    className="flex items-center gap-1.5 hover:text-gray-900 transition"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon column={header.column} />
                  </button>
                ) : (
                  <span>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse border-b border-gray-100 last:border-0">
                {columns.map((_, j) => (
                  <td key={j} className="px-6 py-3.5">
                    <div className={`h-4 bg-gray-100 rounded-md ${skeletonWidths[j]}`} />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-3.5 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-600">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              couples.length
            )} of {couples.length} results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: table.getPageCount() }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => table.setPageIndex(i)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                    table.getState().pagination.pageIndex === i
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
