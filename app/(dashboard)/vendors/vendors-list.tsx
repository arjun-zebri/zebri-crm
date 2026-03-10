'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  useReactTable,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import { Store, Phone, PhoneCall } from 'lucide-react'
import { Vendor, CATEGORY_LABELS } from './vendors-types'
import { Badge } from '@/components/ui/badge'

interface VendorsListProps {
  vendors: Vendor[]
  onRowClick: (vendor: Vendor) => void
  loading: boolean
}

const columnHelper = createColumnHelper<Vendor>()

const COL_WIDTHS: Record<string, string> = {
  name: '22%',
  contact_name: '18%',
  phone: '14%',
  email: '20%',
  category: '14%',
  status: '12%',
}

const columns = [
  columnHelper.accessor('name', {
    header: 'Vendor name',
    enableSorting: false,
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('contact_name', {
    header: 'Contact',
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('phone', {
    header: 'Phone',
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    enableSorting: false,
    cell: (info) => (
      <span className="text-sm text-gray-500 truncate block">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    enableSorting: false,
    cell: (info) => (
      <Badge variant={info.getValue() as any}>
        {CATEGORY_LABELS[info.getValue()]}
      </Badge>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => (
      <div
        title={info.getValue() === 'active' ? 'Active' : 'Inactive'}
        className={`w-3 h-3 rounded-full ${
          info.getValue() === 'active' ? 'bg-emerald-400' : 'bg-gray-300'
        }`}
      />
    ),
  }),
]

const skeletonWidths = ['w-32', 'w-28', 'w-24', 'w-40', 'w-24', 'w-6']

export function VendorsList({
  vendors,
  onRowClick,
  loading,
}: VendorsListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 })
  }, [vendors])

  const table = useReactTable({
    data: vendors,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (vendors.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Store size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-2">No vendors yet.</p>
        <p className="text-sm text-gray-500 mb-4">
          Start building your vendor network.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="overflow-y-auto flex-1">
        <table className="w-full table-fixed max-w-[1800px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500"
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
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.original)}
                    className="border-b border-gray-100 last:border-0 cursor-pointer transition hover:bg-gray-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-6 py-3.5 text-sm overflow-hidden relative group"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}

                        {/* Row hover actions - show only on last cell */}
                        {cell.column.id === 'status' && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition pointer-events-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(row.original.phone)
                              }}
                              title="Copy phone"
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition"
                            >
                              <Phone size={16} />
                            </button>
                            <a
                              href={`tel:${row.original.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Call"
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition"
                            >
                              <PhoneCall size={16} />
                            </a>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 text-sm">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 transition cursor-pointer"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 transition cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
