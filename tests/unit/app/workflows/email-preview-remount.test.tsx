/**
 * The preview frame after it remounts (Phase 5 live check B1).
 *
 * The step detail preview unmounted its iframe while the first edited
 * render was on its way, then mounted a new one when it landed. The
 * `loaded` flag was still true from the first frame, so the email was
 * written into the new frame before its blank document loaded, and that
 * load then wiped it. A subject-only edit leaves the html unchanged, so
 * nothing wrote again and the MC read a blank email captioned "Exactly
 * what Sam & Alex receive".
 *
 * jsdom never loads `srcDoc` itself, so each test plays the frame's
 * load: it blanks the frame's document, as loading `BLANK` does, then
 * fires `load`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmailPreview } from '@/app/(dashboard)/workflows/[id]/email-preview';

const HTML = '<!DOCTYPE html><html><head></head><body><p>The couple email</p></body></html>';

/** Load the frame's blank document, as the browser does, and say so. */
function loadBlank(frame: HTMLIFrameElement) {
  frame.contentDocument!.documentElement.innerHTML = '<head></head><body></body>';
  fireEvent.load(frame);
}

function preview(ready: boolean, html = HTML) {
  return (
    <EmailPreview
      ready={ready}
      subject="Subject"
      html={html}
      frameTitle="Email preview"
      caption="caption"
    />
  );
}

describe('EmailPreview frame', () => {
  it('writes the email once its frame has loaded', () => {
    render(preview(true));
    loadBlank(screen.getByTitle('Email preview') as HTMLIFrameElement);
    const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
    expect(frame.contentDocument!.body.textContent).toContain('The couple email');
  });

  it('writes the same email into a remounted frame after its blank document loads', () => {
    const { rerender } = render(preview(true));
    loadBlank(screen.getByTitle('Email preview') as HTMLIFrameElement);

    // Not ready: the frame unmounts. Ready again with the SAME html, as a
    // subject-only edit renders: a new frame mounts and loads blank.
    rerender(preview(false));
    rerender(preview(true));
    const next = screen.getByTitle('Email preview') as HTMLIFrameElement;
    loadBlank(next);

    expect(next.contentDocument!.body.textContent).toContain('The couple email');
  });

  it('covers a remounted frame until its document is written', () => {
    const { container, rerender } = render(preview(true));
    loadBlank(screen.getByTitle('Email preview') as HTMLIFrameElement);
    expect(container.querySelector('[aria-hidden].absolute')).toBeNull();

    rerender(preview(false));
    rerender(preview(true));
    // The new frame has not loaded: the skeleton stands over it rather
    // than an empty white box.
    expect(container.querySelector('[aria-hidden].absolute')).not.toBeNull();
  });
});
