/**
 * The one document engine (2026-10-09): every Zebri document (proposal,
 * email, contract, invoice, questionnaire, run sheet, script, custom) is
 * a stack of sections edited in the same window, with the same panel,
 * the same text bubble and the same brand. This is its public face;
 * reach in through here, not into its folders.
 *
 * Layout of the module:
 * - `model/`: the document model (`DocLayout`), and where it meets production's.
 * - `registry/`: every kind of section, how it is edited and drawn.
 * - `sections/<kind>/`: the engine's own kinds (Reviews so far).
 * - `doc-types/`: what makes each type of document itself.
 * - `state/`: the editor (production's history behind the engine's guard).
 * - `editor/`: the page, the side panel, the text bubble, the handles.
 * - `look/`: the brand, live, and "Your brand" in the panel.
 * - `render/`: drawing a document read-only (previews, the client's page).
 * - `phone/`: light editing on a phone.
 * - `shell/`: the editor window.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder
 */

export type { DocLayout, DocSection, DocSectionKind, DocType, EngineData, ReviewItem } from './model/types';
export { DOC_TYPES, docTypeOf } from './doc-types';
export type { DocTypeConfig } from './doc-types/spec';
export { SPECS, addableIn, sectionName, specFor } from './registry/kinds';
export type { SectionSpec } from './registry/spec';
export { useDocEditor } from './state/use-doc-editor';
export type { BookingTerms, DocEditor, DocFor, DocMode, FillSection } from './state/use-doc-editor';
export { DocEditorView } from './editor/doc-editor-view';
export { DocShell } from './shell/doc-shell';
export { DocSectionView } from './render/doc-section-view';
export { CouplePage } from './render/couple-page';
