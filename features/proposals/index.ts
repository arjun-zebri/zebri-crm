/**
 * Proposals feature module: the only import path the rest of the app may use
 * for anything under `features/proposals/`. Everything else in this folder
 * is internal; an ESLint `no-restricted-imports` rule enforces the boundary
 * (see `eslint.config.mjs`, "Feature boundary").
 *
 * Phase 1 exports the layout model, validator, presets, migration and the
 * public renderer. Phase 2 adds the editor state. Later phases add the
 * builder and analytics.
 *
 * @module features/proposals
 */

export type {
  AcceptData, ContentWidth, FaqData, GalleryData, PackagesData, PageSettings, ProposalLayout, RichDoc,
  Section, SectionBackground, SectionData, SectionKind, SectionPadding, SectionStyle, TestimonialsData, VideoData,
} from './model/layout'
export {
  CONTENT_WIDTH_PX, detectEmbedProvider, EMBED_PROVIDERS, LAYOUT_LIMITS, MARK_TYPES, NODE_TYPES, SECTION_PADDING_PX,
} from './model/rich-doc-spec'
export type { EmbedProvider, MarkType, NodeType } from './model/rich-doc-spec'
export {
  button, column, columns, doc, embed, heading, hr, image, paragraph, spacer, text, variable,
} from './model/doc'
export type { ButtonAction, ButtonAttrs, ImageAttrs, MarkJSON } from './model/doc'
export { newSectionId, parseProposalLayout, proposalLayoutSchema } from './model/schema'
export type { ParseResult } from './model/schema'
export { isProposalVariable, PROPOSAL_VARIABLES, resolveProposalVariables } from './model/variables'
export { isLayoutV2, migrateProposalTreeToLayout, richValueToDoc } from './model/migrate-v1'
export type { MigrateOptions } from './model/migrate-v1'
export { defaultTemplateLayout, PRESET_IDS, PRESET_LABELS, presetSection } from './model/presets'
export type { PresetId } from './model/presets'
export { embedSrc } from './render/embed-src'
export { HEADING_ROLE, roleCss } from './render/text-roles'
export { RichDocView } from './render/rich-doc'
export type { RenderMode, RichDocContext } from './render/rich-doc'
export { sectionCss } from './render/section-style'
export { toV1Block } from './render/data-section'
export { SectionView } from './render/section'
export type { SectionViewProps } from './render/section'
export { ProposalLayoutView } from './render/layout'
export type { ProposalLayoutViewProps } from './render/layout'
export {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, getTemplateAction, listTemplatesAction,
  renameTemplateAction, setDefaultTemplateAction, updateTemplateLayoutAction,
} from './data/templates'
export type { TemplateRecord, TemplateSummary } from './data/templates'
export { layoutReducer, newSectionFor } from './editor/state'
export type { LayoutAction, LayoutEditorState, NodeSelection, Selection } from './editor/state'
export { useLayoutEditor } from './editor/use-layout-editor'
export type { UseLayoutEditorReturn } from './editor/use-layout-editor'
export {
  buildRichDocExtensions, EDITOR_MARK_NAMES, EDITOR_NODE_NAMES, normaliseEditorJSON, SLASH_MENU_PLUGIN_KEY, SlashMenuExtension,
} from './editor/extensions'
export type { RichDocExtensionOptions } from './editor/extensions'
export { ContentSectionEditor } from './editor/content-section-editor'
export type { ContentSectionEditorProps, EditorNodeSelection } from './editor/content-section-editor'
export {
  getEditor, getRegisteredEditors, registerEditor, unregisterEditor, useRegisteredEditor, useRegisteredEditors,
} from './editor/editor-registry'
export { EDITOR_PROSE_CLASS } from './editor/editor-styles'
export { SectionCanvas } from './editor/section-canvas'
export type { SectionCanvasProps } from './editor/section-canvas'
export { EditableSection } from './editor/editable-section'
export type { EditableSectionProps } from './editor/editable-section'
export {
  FULL_HEIGHT_THRESHOLD_PX, PADDING_SNAPS, paddingToPx, pxToPadding, pxToWidth, widthToPx, WIDTH_SNAPS,
} from './editor/resize/section-resize-math'
export { SectionHeightGrip } from './editor/resize/section-height-grip'
export type { SectionHeightGripProps } from './editor/resize/section-height-grip'
export { SectionWidthHandles } from './editor/resize/section-width-handles'
export type { ColumnRect, SectionWidthHandlesProps } from './editor/resize/section-width-handles'
export { SectionResizeOverlay } from './editor/resize/section-resize-overlay'
export type { SectionResizeOverlayProps } from './editor/resize/section-resize-overlay'
export { isSectionEmpty, useCanvasKeys, useDeleteSection } from './editor/use-canvas-keys'
export type { UseCanvasKeysOptions, UseDeleteSectionReturn } from './editor/use-canvas-keys'
export { stepSelectionOut } from './editor/step-selection-out'
export type { StepSelectionOutOptions } from './editor/step-selection-out'
export { useEditorShortcuts } from './editor/use-editor-shortcuts'
export type { UseEditorShortcutsOptions } from './editor/use-editor-shortcuts'
export { InsertMediaHost } from './editor/insert-media-host'
export type { InsertMediaHandle, InsertMediaHostProps } from './editor/insert-media-host'
export { useInsertMedia } from './editor/use-insert-media'
export type { UseInsertMediaOptions } from './editor/use-insert-media'
export { insertAtomNode } from './editor/insert-atom-node'
export { EmbedInsertModal } from './editor/embed-insert-modal'
export type { EmbedInsertModalProps } from './editor/embed-insert-modal'
export { InsertMediaStatusPill } from './editor/insert-media-status-pill'
export type { InsertMediaStatus, InsertMediaStatusPillProps } from './editor/insert-media-status-pill'
export { AddLine, SECTION_CAP_MESSAGE } from './editor/add-line'
export type { AddLineProps } from './editor/add-line'
export { AddPalette } from './editor/add-palette'
export type { AddPaletteProps } from './editor/add-palette'
export { useAddPalette } from './editor/use-add-palette'
export type { UseAddPaletteReturn } from './editor/use-add-palette'
export { filterInsertItems, INSERT_ITEMS } from './editor/insert-items'
export type { InsertItem } from './editor/insert-items'
export { MEDIA_LIMITS, uploadProposalMediaFile } from './data/media'
export type { MediaKind, MediaLimit } from './data/media'
export { BarShell } from './editor/bars/bar-shell'
export type { BarShellProps } from './editor/bars/bar-shell'
export { ControlDot, OverrideDot } from './editor/bars/override-dot'
export type { ControlDotProps, OverrideDotProps } from './editor/bars/override-dot'
export { SectionBar } from './editor/bars/section-bar'
export type { SectionBarProps } from './editor/bars/section-bar'
export { LINK_ERROR, LINK_PATTERN } from './editor/bars/link-popover'
export { applyTextStyle, bubbleShouldShow, readTextState } from './editor/bars/text-bar-style'
export type { CaseValue, StyleValue, TextState, TextStylePatch } from './editor/bars/text-bar-style'
export { TextBar, TextBarRow } from './editor/bars/text-bar'
export type { TextBarHandle, TextBarProps } from './editor/bars/text-bar'
export { NodeBar } from './editor/bars/node-bar'
export type { NodeBarProps } from './editor/bars/node-bar'
export type { NodeBarSection } from './editor/bars/node-bar-shared'
export { EMBED_ERROR } from './editor/bars/node-bar-embed'
export { ALT_WARNING } from './editor/bars/node-bar-image'
export { TemplateEditor } from './editor/template-editor'
export type { TemplateEditorProps } from './editor/template-editor'
export { useTemplateAutosave } from './editor/use-template-autosave'
export type { UseTemplateAutosaveReturn } from './editor/use-template-autosave'
