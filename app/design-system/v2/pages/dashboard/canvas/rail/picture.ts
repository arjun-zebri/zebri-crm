import type { CanvasElement } from '../model';

import type { RailApi } from './api';
import { imageOf } from './presets';

/**
 * A picture from the Brand or Uploads tab, put where Canva would: into
 * the picked picture frame if one is picked (its frame keeps its size),
 * else onto the page in view at its own proportions, 360px wide.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/picture
 */
export function putPicture(api: RailApi, src: string) {
  const frame = api.style.picked.length === 1 && api.style.picked[0]!.kind === 'image' ? api.style.picked[0]! : null;
  if (frame) {
    api.canvas.update([frame.id], { src } as Partial<CanvasElement>);
    return;
  }
  const img = new Image();
  img.onload = () => {
    const w = 360;
    api.add(imageOf(src, w, Math.round((w * img.naturalHeight) / Math.max(1, img.naturalWidth))));
  };
  img.src = src;
}
