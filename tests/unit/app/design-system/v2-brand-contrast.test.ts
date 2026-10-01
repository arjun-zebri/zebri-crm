import { readableOn } from '@/app/design-system/v2/pages/onboarding/brand-doc-parts';

describe('readableOn (v2 brand preview)', () => {
  it('puts light text on dark and mid-tone brand colours', () => {
    expect(readableOn('#1f2a44')).toBe('#ffffff');
    expect(readableOn('#2f521f')).toBe('#ffffff');
    // A mid green the old brightness cutoff gave dark text.
    expect(readableOn('#3e7931')).toBe('#ffffff');
  });

  it('puts dark text on pale colours', () => {
    expect(readableOn('#e3f4d3')).toBe('#111827');
    expect(readableOn('#ffffff')).toBe('#111827');
  });

  it('falls back to white for a colour it cannot read', () => {
    expect(readableOn('#abc')).toBe('#ffffff');
  });
});
