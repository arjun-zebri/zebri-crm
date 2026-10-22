import type { AddTileProps } from '@/components/ui-v2/add-tile';

import type { Style } from '../toolbar/use-style';
import type { Canvas } from '../use-canvas';

import type { Unplaced } from './presets';

/**
 * What every rail panel gets: the canvas, a way to add an element to the
 * page in view, the drag props that let a tile be dropped on a page
 * instead, and the toolbar's style writer (the Brand tab's colours land
 * on whatever is picked).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/api
 */
export interface RailApi {
  canvas: Canvas;
  add: (el: Unplaced) => void;
  drag: (make: () => Unplaced) => Pick<AddTileProps, 'onDragStart' | 'onDragEnd'>;
  style: Style;
}
