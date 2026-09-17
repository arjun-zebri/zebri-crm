/**
 * Compatibility re-export: the toolbar primitives moved to `components/editor`
 * (Proposal Layout v2 Phase 2, spec 5.3) so the Branding and proposal editors
 * share one set. Removed in Phase 5 with the Branding toolbar rebuild.
 *
 * @module app/(dashboard)/branding/blocks/toolbar-primitives
 */
export { PillToggle, ActiveTargetLabel, VAlignIcon, ToolbarDivider, IncludeDropdown } from '@/components/editor'
export type { IncludeRow } from '@/components/editor'
