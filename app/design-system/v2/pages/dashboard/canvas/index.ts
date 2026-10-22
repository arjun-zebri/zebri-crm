/**
 * The canvas: Zebri's one Canva-style editor for every document. Its
 * public API; reach for these, not the files behind them.
 *
 * @module app/design-system/v2/pages/dashboard/canvas
 */
export { CanvasEditor, type CanvasEditorProps } from './canvas-editor';
export { CanvasDataProvider, useCanvasData, type CanvasData } from './canvas-context';
export { useCanvas, type Canvas } from './use-canvas';
export * from './model';
