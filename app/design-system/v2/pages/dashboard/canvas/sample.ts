import { A4, type CanvasDoc } from './model';

/**
 * A two-page proposal laid out as a canvas: a cover (logo, a picture
 * slot, the couple's names, a heading and an intro) and a fees page with
 * a locked total, the shape a required part takes. Used by the canvas
 * playground until each document type brings its own layout.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/sample
 */

/** The sample proposal. */
export const SAMPLE_DOC: CanvasDoc = {
  id: 'sample',
  kind: 'proposal',
  title: 'Wedding MC proposal',
  pages: [
    {
      id: 'p1',
      ...A4,
      background: 'kit:paper',
      elements: [
        { id: 'logo', name: 'Logo', kind: 'logo', variant: 'main', x: 64, y: 56, w: 260, h: 44 },
        { id: 'hero', name: 'Picture', kind: 'image', src: null, fit: 'cover', x: 64, y: 140, w: 666, h: 420, box: { radius: 6 } },
        { id: 'eyebrow', name: 'Eyebrow', kind: 'field', field: 'couple', look: { role: 'caption', color: 'kit:primary' }, x: 64, y: 608, w: 400, h: 20 },
        { id: 'title', name: 'Heading', kind: 'text', text: 'Your wedding, hosted', look: { role: 'heading' }, x: 64, y: 640, w: 560, h: 56 },
        {
          id: 'intro',
          name: 'Intro',
          kind: 'text',
          text: 'Thank you for thinking of me for your day. Here is how I would run it, from the first welcome to the last dance, and what it costs.',
          look: { role: 'body', color: 'kit:muted' },
          x: 64,
          y: 716,
          w: 520,
          h: 80,
        },
        { id: 'band', name: 'Band', kind: 'shape', shape: 'rect', x: 0, y: 1043, w: 794, h: 80, box: { fill: 'kit:primary' } },
      ],
    },
    {
      id: 'p2',
      ...A4,
      background: 'kit:paper',
      elements: [
        { id: 'fees-title', name: 'Heading', kind: 'text', text: 'Fees', look: { role: 'subheading' }, x: 64, y: 64, w: 400, h: 40 },
        { id: 'rule', name: 'Line', kind: 'shape', shape: 'line', x: 64, y: 120, w: 666, h: 8, box: { fill: 'kit:ink', opacity: 0.15 } },
        { id: 'pkg', name: 'Package', kind: 'text', text: 'Ceremony and reception MC\nFull day, up to 10 hours', look: { role: 'body' }, x: 64, y: 144, w: 420, h: 56 },
        { id: 'total', name: 'Total', kind: 'field', field: 'total', locked: true, look: { role: 'subheading', align: 'right' }, x: 470, y: 144, w: 260, h: 40 },
        { id: 'dot', name: 'Circle', kind: 'shape', shape: 'ellipse', x: 64, y: 260, w: 120, h: 120, box: { fill: 'kit:accent' } },
      ],
    },
  ],
};
