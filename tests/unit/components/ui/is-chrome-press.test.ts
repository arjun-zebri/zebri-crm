/**
 * Unit tests for the outside-press guard.
 *
 * Every dropdown and panel in the app closes on a press outside its own ref.
 * Without this guard, reaching for the Feedback pill folded away the very
 * thing the MC was trying to report.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { isChromePress } from '@/components/ui/use-overlay';

function mount(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isChromePress', () => {
  it('treats the Feedback pill as chrome', () => {
    const host = mount('<button data-capture-hide><span>Feedback</span></button>');
    expect(isChromePress(host.querySelector('button'))).toBe(true);
  });

  it('matches a press on something nested inside the chrome', () => {
    // Real presses land on the icon or the label, not the button itself.
    const host = mount('<button data-capture-hide><span id="label">Feedback</span></button>');
    expect(isChromePress(host.querySelector('#label'))).toBe(true);
  });

  it('treats the feedback form as chrome', () => {
    const host = mount('<div data-capture-hide><div id="panel">form</div></div>');
    expect(isChromePress(host.querySelector('#panel'))).toBe(true);
  });

  it('does NOT treat an ordinary modal as chrome', () => {
    // An ordinary modal is usually the thing being reported, so it must show
    // up in the screenshot and behave like page content.
    const host = mount('<div role="dialog"><div id="panel">Add event</div></div>');
    expect(isChromePress(host.querySelector('#panel'))).toBe(false);
  });

  it('treats ordinary page content as a real outside press', () => {
    const host = mount('<div><button id="save">Save</button></div>');
    expect(isChromePress(host.querySelector('#save'))).toBe(false);
  });

  it('is false for a null target', () => {
    expect(isChromePress(null)).toBe(false);
  });

  it('is false for a non-element target', () => {
    // A press can report a text node or a non-DOM EventTarget.
    expect(isChromePress(document.createTextNode('x'))).toBe(false);
    expect(isChromePress(new EventTarget())).toBe(false);
  });
});
