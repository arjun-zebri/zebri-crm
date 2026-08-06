/**
 * Generic "Browse starters" catalog modal for the non-email template tabs
 * (packages, quotes, invoices, contracts).
 *
 * Mirrors the Emails `StarterLibraryPanel` look and behaviour, minus the
 * lifecycle-stage grouping these flat catalogs don't have. Entries the MC
 * already owns are hidden, so the list only ever shows what's addable. The
 * caller owns the actual insert + cache invalidation via {@link onAdd},
 * which returns the number of rows added.
 *
 * @module app/(dashboard)/templates/starter-catalog-modal
 */
'use client'

import { Plus } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

/** A single addable catalog entry. */
export interface StarterCatalogItem {
  name: string
  /** Short subtitle shown under the name. */
  subtitle: string
}

interface StarterCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  /** Modal heading, e.g. "Browse starter packages". */
  title: string
  /** One-line blurb above the list. */
  blurb: string
  /** Singular noun for toasts, e.g. "package". */
  noun: string
  /** Full catalog for this template type. */
  catalog: readonly StarterCatalogItem[]
  /** Names already in the MC's list, hidden from the catalog. */
  existingNames: Set<string>
  /** Insert the named starters; resolves to the number actually added. */
  onAdd: (names: string[]) => Promise<number>
}

export function StarterCatalogModal({
  isOpen,
  onClose,
  title,
  blurb,
  noun,
  catalog,
  existingNames,
  onAdd,
}: StarterCatalogModalProps) {
  const { toast } = useToast()

  // Addable = catalog minus what the MC already has (matched by name).
  const addable = useMemo(
    () => catalog.filter((item) => !existingNames.has(item.name)),
    [catalog, existingNames],
  )

  async function addNames(names: string[], label: string) {
    try {
      const added = await onAdd(names)
      toast(added === 1 ? `Added ${label}` : `Added ${added} ${noun}s`, 'success')
    } catch {
      toast(`Could not add ${noun}s`, 'error')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {addable.length === 0 ? (
        <p className="py-10 text-center text-body text-text-subtle">
          You&apos;ve added every starter. Anything you delete can be re-added here.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-body text-text-muted">{blurb}</p>
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => addNames(addable.map((i) => i.name), `all ${noun}s`)}
            >
              Add all
            </Button>
          </div>
          <ul>
            {addable.map((item) => (
              <li key={item.name} className="flex items-center gap-3 rounded-control px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-text">{item.name}</p>
                  <p className="truncate text-caption text-text-subtle">{item.subtitle}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1.5"
                  onClick={() => addNames([item.name], item.name)}
                  aria-label={`Add ${item.name}`}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
