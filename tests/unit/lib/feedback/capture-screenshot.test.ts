/**
 * Unit tests for the feedback screenshot capture.
 *
 * The two things that silently ruin a capture are including the feedback UI
 * itself (you get a picture of the modal, not the bug) and blowing the 5MB
 * upload cap, so both are pinned here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const domToBlob = vi.fn();
vi.mock('modern-screenshot', () => ({ domToBlob: (...args: unknown[]) => domToBlob(...args) }));

const { captureViewport } = await import('@/lib/feedback/capture-screenshot');

/** The options object handed to domToBlob on call `n`. */
function optionsOf(n = 0) {
  return domToBlob.mock.calls[n]![1] as {
    scale: number;
    width: number;
    height: number;
    backgroundColor: string;
    filter: (node: Node) => boolean;
  };
}

function blobOf(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

describe('captureViewport', () => {
  beforeEach(() => {
    domToBlob.mockReset();
    domToBlob.mockResolvedValue(blobOf(1024));
    vi.stubGlobal('innerWidth', 1512);
    vi.stubGlobal('innerHeight', 857);
    vi.stubGlobal('devicePixelRatio', 2);
    window.history.replaceState({}, '', '/payments');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures the viewport, not the whole document', async () => {
    await captureViewport();
    const opts = optionsOf();
    expect(opts.width).toBe(1512);
    expect(opts.height).toBe(857);
    expect(domToBlob.mock.calls[0]![0]).toBe(document.body);
  });

  it('leaves out the feedback chrome', async () => {
    await captureViewport();
    const { filter } = optionsOf();

    const feedbackForm = document.createElement('div');
    feedbackForm.setAttribute('data-capture-hide', '');
    const pill = document.createElement('button');
    pill.setAttribute('data-capture-hide', '');

    expect(filter(feedbackForm)).toBe(false);
    expect(filter(pill)).toBe(false);
  });

  it('keeps ordinary modals, which are usually the thing being reported', async () => {
    await captureViewport();
    const { filter } = optionsOf();

    // Excluding every modal meant a shot taken from inside one (say, Add
    // event on top of the couple modal) showed the page beneath instead.
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    expect(filter(modal)).toBe(true);
    expect(filter(document.createElement('div'))).toBe(true);
  });

  it('keeps text nodes, which carry no attributes to match on', async () => {
    await captureViewport();
    expect(optionsOf().filter(document.createTextNode('Couples'))).toBe(true);
  });

  it('caps the scale at 2 even on a 3x display', async () => {
    vi.stubGlobal('devicePixelRatio', 3);
    await captureViewport();
    expect(optionsOf().scale).toBe(2);
  });

  it('retries at 1x when the retina shot blows the 5MB cap', async () => {
    domToBlob.mockResolvedValueOnce(blobOf(6 * 1024 * 1024)).mockResolvedValueOnce(blobOf(2048));
    await captureViewport();
    expect(domToBlob).toHaveBeenCalledTimes(2);
    expect(optionsOf(0).scale).toBe(2);
    expect(optionsOf(1).scale).toBe(1);
  });

  it('does not retry when already at 1x', async () => {
    vi.stubGlobal('devicePixelRatio', 1);
    domToBlob.mockResolvedValue(blobOf(6 * 1024 * 1024));
    await captureViewport();
    expect(domToBlob).toHaveBeenCalledTimes(1);
  });

  it('names the file after the route it was taken on', async () => {
    const file = await captureViewport();
    expect(file.name).toMatch(/^zebri-payments-\d{4}-\d{2}-\d{2}T[\d-]+\.png$/);
    expect(file.type).toBe('image/png');
  });

  it('falls back to a usable name at the root route', async () => {
    window.history.replaceState({}, '', '/');
    const file = await captureViewport();
    expect(file.name).toMatch(/^zebri-dashboard-/);
  });

  it('paints a background so a transparent body is not rasterised black', async () => {
    await captureViewport();
    expect(optionsOf().backgroundColor).toBeTruthy();
  });
});
