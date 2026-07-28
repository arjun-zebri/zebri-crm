/**
 * Unit tests for buildPublicBranding — the pure helper inside
 * useCurrentBranding that assembles a PublicBranding object from
 * raw user_metadata. The hook itself is exercised via integration
 * (it makes real Supabase calls).
 */
import { describe, expect, it } from 'vitest';

import { buildPublicBranding } from '@/lib/branding/use-current-branding';

describe('buildPublicBranding', () => {
  it('falls back to the Minimal theme when metadata is empty', () => {
    const result = buildPublicBranding({});
    expect(result.theme_preset).toBe('minimal');
    expect(result.brand_color).toBe('#111827');
    expect(result.font_heading).toBe('inter');
    expect(result.density).toBe('cozy');
    expect(result.show_contact_on_documents).toBe(true);
  });

  it('uses the named theme preset when set', () => {
    const result = buildPublicBranding({ theme_preset: 'bold' });
    expect(result.theme_preset).toBe('bold');
    expect(result.brand_color).toBe('#FF6B35');
  });

  it('lets explicit metadata override theme defaults', () => {
    const result = buildPublicBranding({
      theme_preset: 'minimal',
      brand_color: '#FF00FF',
      business_name: 'Acme Weddings',
    });
    expect(result.brand_color).toBe('#FF00FF');
    expect(result.business_name).toBe('Acme Weddings');
  });

  it('sanitises unknown font_heading values to the fallback', () => {
    const result = buildPublicBranding({ font_heading: 'comic_sans' });
    expect(result.font_heading).toBe('inter');
  });

  it('sanitises out-of-range font_weight to the fallback', () => {
    const result = buildPublicBranding({ font_weight: 999 });
    expect(result.font_weight).toBe(600); // minimal headingWeight
  });

  it('preserves explicit nullable bank details', () => {
    const result = buildPublicBranding({
      bank_account_name: 'Anna & Jake',
      bank_bsb: '062-000',
      bank_account_number: '12345678',
    });
    expect(result.bank_account_name).toBe('Anna & Jake');
    expect(result.bank_bsb).toBe('062-000');
  });
});
