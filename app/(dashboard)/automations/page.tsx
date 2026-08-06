/**
 * /automations - list / hub page.
 *
 * Page owns the filter + pagination state so the pagination
 * footer can live outside the scroll container (anchored to the
 * viewport bottom - matches the couples-list pattern).
 *
 * @module app/(dashboard)/automations/page
 */
'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/ui/page-header'
import type { AutomationsHomePayload } from '@/types/automations'

import { createAutomationAction, loadAutomationsHomeAction } from './actions'
import { applyFilter, type StatusFilter } from './automations-filter'
import { AutomationsHome } from './automations-home'
import { PaginationBar } from './pagination-bar'

export default function AutomationsPage() {
  const router = useRouter()
  const [payload, setPayload] = useState<AutomationsHomePayload | null>(null)
  const [pending, setPending] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    const result = await loadAutomationsHomeAction()
    if (result.ok) setPayload(result.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPageIndex(0)
  }, [statusFilter, query])

  async function handleCreate() {
    setPending(true)
    const result = await createAutomationAction({
      name: 'Untitled automation',
      triggerType: 'unset',
      triggerConfig: {},
    })
    setPending(false)
    if (result.ok) router.push(`/automations/${result.data.id}`)
  }

  const filtered = useMemo(() => {
    if (!payload) return []
    return applyFilter(payload.automations, statusFilter, query)
  }, [payload, statusFilter, query])

  const paged = useMemo(() => {
    const start = pageIndex * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageIndex, pageSize])

  const hasRows = filtered.length > 0
  const isEmptyState = payload !== null && payload.automations.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 sm:px-[3.75rem] pt-6 pb-3 flex-shrink-0">
        <PageHeader
          title="Automations"
          className="mb-4"
          actions={
            !isEmptyState && (
            <>
              <button
                onClick={handleCreate}
                disabled={pending}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer disabled:opacity-50"
              >
                <Plus size={11} strokeWidth={2} />
                New automation
              </button>
              <button
                onClick={handleCreate}
                disabled={pending}
                className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer disabled:opacity-50"
                aria-label="New automation"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </>
            )
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="px-6 sm:px-[3.75rem] pb-6 flex-1 flex flex-col">
          <AutomationsHome
            payload={payload}
            paged={paged}
            pending={pending}
            statusFilter={statusFilter}
            query={query}
            onStatusChange={setStatusFilter}
            onQueryChange={setQuery}
            onOpen={(id) => router.push(`/automations/${id}`)}
            onCreate={handleCreate}
            onChange={() => void load()}
          />
        </div>
      </div>

      {payload && hasRows && (
        <PaginationBar
          total={filtered.length}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPageIndex(0)
          }}
        />
      )}
    </div>
  )
}
