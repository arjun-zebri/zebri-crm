import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const LOADER = readFileSync(resolve(process.cwd(), 'public/lead-embed.js'), 'utf8');

describe('lead-embed.js', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('injects an iframe pointing at the embed variant from its data attribute', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-form', 'tok-123');
    s.src = 'https://app.zebri.com.au/lead-embed.js';
    document.body.appendChild(s);
    // Emulate document.currentScript for the IIFE.
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe(
      'https://app.zebri.com.au/lead/tok-123?embed=1',
    );
  });

  it('does nothing without a data-zebri-form attribute', () => {
    const s = document.createElement('script');
    s.src = 'https://app.zebri.com.au/lead-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
