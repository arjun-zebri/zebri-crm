/**
 * Proposals feature module: the only import path the rest of the app may use
 * for anything under `features/proposals/`. Everything else in this folder
 * is internal; an ESLint `no-restricted-imports` rule enforces the boundary
 * (see `eslint.config.mjs`, "Feature boundary").
 *
 * Phase 1 exports the layout model, validator, presets, migration and the
 * public renderer. Later phases add the editor, builder and analytics.
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
