/**
 * React NodeViews for the rich doc's atom/container nodes: the canvas
 * renders each of these instead of the plain schema DOM when the owning
 * extension is configured with `nodeViews: true`
 * (`buildRichDocExtensions({ nodeViews: true })`, set by
 * `ContentSectionEditor`), so what the MC sees while editing is the same
 * markup the public page renders, with click-to-select and (image,
 * columns, spacer) drag-to-resize on top.
 *
 * @module features/proposals/editor/node-views
 */
export { NodeGrips } from './node-grips'
export type { NodeGripsProps } from './node-grips'
export { ImageView } from './image-view'
export { ButtonView } from './button-view'
export { EmbedView } from './embed-view'
export { AudioView } from './audio-view'
export { ColumnsView } from './columns-view'
export { SpacerView } from './spacer-view'
