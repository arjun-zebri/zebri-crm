import { describe, expect, it } from 'vitest';

import { extractSignals, findContactPath, mergeSignals, visibleText } from '@/lib/outreach/checks/website-signals';

const NOW = new Date('2026-10-11T00:00:00Z');

const LIVE = `<html><head><style>.x{}</style><script>var y = "2031";</script></head><body>
  <nav><a href="/about">About</a><a href="/contact-me">Contact</a><a href="https://www.instagram.com/jane.celebrant/">IG</a>
  <a href="https://instagram.com/p/xyz">post</a><a href="https://facebook.com/JaneCelebrant">FB</a></nav>
  <h1>Jane, marriage celebrant in Melbourne</h1>
  <p>Now booking weddings for 2026 and 2027. Email <a href="mailto:Hello@JaneCelebrant.com.au?subject=hi">me</a>.</p>
  <img src="logo@2x.png"><p>Reach me: jane@gmail.com or noreply@wordpress.com</p>
  <footer>&copy; 2019 Jane</footer></body></html>`;

describe('extractSignals', () => {
  it('reads years, wedding content, contacts and the contact page', () => {
    const s = extractSignals(LIVE, 'https://janecelebrant.com.au/', NOW);
    expect(s.parked).toBe(false);
    // 2027 is in the future and ignored; script contents never count.
    expect(s.latestYear).toBe(2026);
    expect(s.weddingContent).toBe(true);
    expect(s.emails).toEqual(['hello@janecelebrant.com.au', 'jane@gmail.com']);
    expect(s.instagramHandles).toEqual(['jane.celebrant']);
    expect(s.facebookUrls).toEqual(['https://www.facebook.com/JaneCelebrant']);
    expect(s.contactPath).toBe('https://janecelebrant.com.au/contact-me');
  });

  it('flags parking pages', () => {
    const html = '<html><body><h1>This domain is for sale!</h1><p>Buy this domain today at HugeDomains.</p><a href="/">x</a><a href="/">y</a><a href="/">z</a></body></html>';
    expect(extractSignals(html, 'https://old.com', NOW).parked).toBe(true);
  });

  it('flags near-empty shells as parked', () => {
    expect(extractSignals('<html><body>Coming soon</body></html>', 'https://x.com', NOW).parked).toBe(true);
  });
});

describe('findContactPath', () => {
  it('prefers contact over about and stays on the same host', () => {
    const links = ['https://other.com/contact', '/about-us', '/contact'];
    expect(findContactPath(links, 'https://site.com/')).toBe('https://site.com/contact');
  });

  it('ignores mailto, tel and anchors', () => {
    expect(findContactPath(['mailto:a@b.com', 'tel:123', '#contact'], 'https://site.com/')).toBeNull();
  });
});

describe('mergeSignals', () => {
  it('unions contacts and keeps the newest year', () => {
    const home = extractSignals('<p>est 2015 weddings</p>' + '<a href="/">a</a>'.repeat(3) + 'x'.repeat(100), 'https://s.com', NOW);
    const contact = extractSignals('<p>2025 bookings open, email a@s.com</p>' + 'y'.repeat(100), 'https://s.com/contact', NOW);
    const merged = mergeSignals(home, contact);
    expect(merged.latestYear).toBe(2025);
    expect(merged.emails).toEqual(['a@s.com']);
  });
});

describe('visibleText', () => {
  it('drops scripts and styles', () => {
    expect(visibleText('<script>2030</script><style>a{}</style><p>Hi &amp; bye</p>')).toBe('Hi & bye');
  });
});
