/**
 * Pure helper for duplicating a template's layout (`duplicateTemplateAction`,
 * spec/audit §3.9): every section gets a fresh id, so the copy never
 * shares a `jump` button target or a React key with the original. Only
 * section ids are re-minted - nothing inside a section's rich doc (button
 * `jump` targets aside, which reference a *section* id and are rewritten
 * below) carries an id that needs to stay unique across templates.
 *
 * @module features/proposals/model/clone-layout
 */
import type { ProposalLayout, Section } from './layout'
import { newSectionId } from './schema'

/**
 * Clone `layout` with every section given a fresh id, and every in-doc
 * `jump` button's `sectionId` rewritten to follow its target section to
 * its new id - so a duplicated template's internal "jump to section"
 * buttons still point at the right place instead of a section id that no
 * longer exists in the copy.
 */
export function cloneLayoutWithFreshIds(layout: ProposalLayout): ProposalLayout {
  const idMap = new Map(layout.sections.map((section) => [section.id, newSectionId()]))
  const sections = layout.sections.map((section): Section => ({
    ...section,
    id: idMap.get(section.id) ?? newSectionId(),
    ...(section.content ? { content: rewriteJumpTargets(section.content, idMap) } : {}),
    ...(section.intro ? { intro: rewriteJumpTargets(section.intro, idMap) } : {}),
  }))
  return { ...layout, sections }
}

/** Recursively rewrite every `button` node's `jump` action target through `idMap`, leaving unmapped/other actions untouched. */
function rewriteJumpTargets<T>(node: T, idMap: ReadonlyMap<string, string>): T {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((child) => rewriteJumpTargets(child, idMap)) as unknown as T
  const record = node as Record<string, unknown>
  if (record.type === 'button') {
    const attrs = record.attrs as { action?: { kind?: string; sectionId?: string } } | undefined
    const action = attrs?.action
    if (action?.kind === 'jump' && action.sectionId) {
      const mapped = idMap.get(action.sectionId)
      if (mapped) {
        return {
          ...record,
          attrs: { ...attrs, action: { ...action, sectionId: mapped } },
        } as unknown as T
      }
    }
  }
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    next[key] = rewriteJumpTargets(value, idMap)
  }
  return next as T
}
