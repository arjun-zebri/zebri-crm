/**
 * Tests for the book-embed.js loader script.
 *
 * Verifies:
 * - Script tag discovery via data-zebri-booking attribute
 * - Iframe injection with /book/<token>?embed=1 src
 * - Height message handling (type: 'zebri-book-height')
 * - Wrong-origin message rejection
 *
 * @module tests/unit/booking/book-embed-loader
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const LOADER = readFileSync(resolve(process.cwd(), 'public/book-embed.js'), 'utf8');

describe('book-embed.js', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('injects an iframe pointing at the embed variant from its data attribute', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    // Emulate document.currentScript for the IIFE.
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe(
      'https://app.zebri.com.au/book/tok-456?embed=1',
    );
  });

  it('does nothing without a data-zebri-booking attribute', () => {
    const s = document.createElement('script');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('resizes iframe when receiving zebri-book-height message from matching origin', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();

    // Verify initial min-height is set
    expect(iframe!.style.minHeight).toBe('640px');

    // Simulate height message from matching origin
    const event = new MessageEvent('message', {
      origin: 'https://app.zebri.com.au',
      data: { type: 'zebri-book-height', height: 800 },
    });

    window.dispatchEvent(event);
    expect(iframe!.style.height).toBe('800px');
  });

  it('ignores height messages from mismatched origin', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;

    // Simulate height message from mismatched origin
    const event = new MessageEvent('message', {
      origin: 'https://evil.com',
      data: { type: 'zebri-book-height', height: 800 },
    });

    window.dispatchEvent(event);
    expect(iframe!.style.height).toBe('');
  });

  it('ignores messages that are not zebri-book-height type', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;

    // Simulate message with wrong type
    const event = new MessageEvent('message', {
      origin: 'https://app.zebri.com.au',
      data: { type: 'some-other-message', height: 800 },
    });

    window.dispatchEvent(event);
    expect(iframe!.style.height).toBe('');
  });

  it('sets iframe attributes correctly', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    document.body.appendChild(s);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe!.title).toBe('Booking form');
    expect(iframe!.getAttribute('loading')).toBe('lazy');
    expect(iframe!.style.width).toBe('100%');
    expect(iframe!.style.border).toBe('0px');
    expect(iframe!.style.minHeight).toBe('640px');
  });

  it('inserts iframe after the script tag', () => {
    const s = document.createElement('script');
    s.setAttribute('data-zebri-booking', 'tok-456');
    s.src = 'https://app.zebri.com.au/book-embed.js';
    const container = document.createElement('div');
    container.appendChild(s);
    document.body.appendChild(container);
    Object.defineProperty(document, 'currentScript', { value: s, configurable: true });

    new Function(LOADER)();

    const children = Array.from(container.childNodes);
    const scriptIndex = children.indexOf(s);
    const iframeIndex = children.findIndex((n) => (n as any).tagName === 'IFRAME');

    expect(iframeIndex).toBe(scriptIndex + 1);
  });
});
