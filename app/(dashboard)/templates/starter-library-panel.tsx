/**
 * "Browse starter templates" catalog.
 *
 * Nothing is auto-seeded — this modal lets an MC add the starter
 * templates they want (including the celebrant-specific ones) on demand.
 * Catalog entries already in the library are hidden, so the list only
 * ever shows what's addable. Grouped by lifecycle stage to match the
 * Emails library.
 *
 * @module app/(dashboard)/templates/starter-library-panel
 */
'use client'

import { Plus } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { STARTER_EMAIL_TEMPLATES, type StarterTemplate } from '@/lib/email/starter-templates'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES } from '@/types/email-template'

import { useAddStarterTemplates } from './use-templates'

interface StarterLibraryPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Names already in the MC's library — hidden from the catalog. */
  existingNames: Set<string>
}

export function StarterLibraryPanel({ isOpen, onClose, existingNames }: StarterLibraryPanelProps) {
  const { toast } = useToast()
  const add = useAddStarterTemplates()

  // Addable = catalog minus what the MC already has, grouped by stage.
  const groups = useMemo(() => {
    const addable = STARTER_EMAIL_TEMPLATES.filter((t) => !existingNames.has(t.name))
    return LIFECYCLE_STAGES.map((stage) => ({
      stage,
      label: LIFECYCLE_LABELS[stage],
      items: addable.filter((t) => t.lifecycleStage === stage),
    })).filter((g) => g.items.length > 0)
  }, [existingNames])

  const remainingCount = groups.reduce((n, g) => n + g.items.length, 0)

  async function addNames(names: string[], label: string) {
    try {
      const { added } = await add.mutateAsync(names)
      toast(added === 1 ? `Added ${label}` : `Added ${added} templates`, 'success')
    } catch {
      toast('Could not add templates', 'error')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Browse starter templates" size="lg">
      {remainingCount === 0 ? (
        <p className="py-10 text-center text-body text-text-subtle">
          You&apos;ve added every starter template. Anything you delete can be re-added here.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-body text-text-muted">
              Add the templates you want, including the celebrant-specific ones. Nothing is added unless you choose it.
            </p>
            <Button
              variant="secondary"
              className="shrink-0"
              loading={add.isPending}
              onClick={() => addNames(groups.flatMap((g) => g.items.map((t) => t.name)), 'all templates')}
            >
              Add all
            </Button>
          </div>

          {groups.map((group) => (
            <section key={group.stage}>
              <h3 className="px-1 text-body font-semibold uppercase tracking-wider text-text-subtle">{group.label}</h3>
              <ul className="mt-1">
                {group.items.map((t) => (
                  <StarterRow key={t.name} template={t} pending={add.isPending} onAdd={() => addNames([t.name], t.name)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}

function StarterRow({
  template,
  pending,
  onAdd,
}: {
  template: StarterTemplate
  pending: boolean
  onAdd: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-control px-1 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text">{template.name}</p>
        <p className="truncate text-body text-text-subtle">{template.subject || template.description}</p>
      </div>
      <Button variant="ghost" className="shrink-0 gap-1.5" disabled={pending} onClick={onAdd} aria-label={`Add ${template.name}`}>
        <Plus size={14} strokeWidth={1.5} />
        Add
      </Button>
    </li>
  )
}
