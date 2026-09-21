/**
 * @module tests/unit/features/proposals/settings-schemas
 */
import { describe, expect, it } from 'vitest';

import {
  parseStoredSettings,
  resolveTemplateSettings,
  updateProposalSettingsSchema,
  updateTemplateSettingsSchema,
} from '@/features/proposals/data/settings-schemas';

const VALID = {
  password_enabled: false,
  allow_download: true,
  expiry_days: 14,
  deposit_percent: 30,
  link_preview: null,
};

describe('updateProposalSettingsSchema', () => {
  it('accepts a valid payload with a null link preview', () => {
    expect(updateProposalSettingsSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts a valid link preview object', () => {
    const result = updateProposalSettingsSchema.safeParse({
      ...VALID,
      link_preview: { title: 'A wedding proposal', imageUrl: 'https://example.com/preview.png' },
    });
    expect(result.success).toBe(true);
  });

  it.each([0, 366])('rejects expiry_days out of the 1-365 range: %i', (expiry_days) => {
    expect(updateProposalSettingsSchema.safeParse({ ...VALID, expiry_days }).success).toBe(false);
  });

  it.each([-1, 101])('rejects deposit_percent out of the 0-100 range: %i', (deposit_percent) => {
    expect(updateProposalSettingsSchema.safeParse({ ...VALID, deposit_percent }).success).toBe(false);
  });

  it('rejects a non-url link preview image', () => {
    const result = updateProposalSettingsSchema.safeParse({ ...VALID, link_preview: { imageUrl: 'not-a-url' } });
    expect(result.success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const missing: Partial<typeof VALID> = { ...VALID };
    delete missing.password_enabled;
    expect(updateProposalSettingsSchema.safeParse(missing).success).toBe(false);
  });
});

describe('updateTemplateSettingsSchema', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('accepts a template id with a full settings snapshot', () => {
    expect(updateTemplateSettingsSchema.safeParse({ id: ID, settings: VALID }).success).toBe(true);
  });

  it('accepts null settings (the template goes back to the account defaults)', () => {
    expect(updateTemplateSettingsSchema.safeParse({ id: ID, settings: null }).success).toBe(true);
  });

  it('rejects a partial snapshot, so an omitted field can never be written as a default', () => {
    const partial: Partial<typeof VALID> = { ...VALID };
    delete partial.expiry_days;
    expect(updateTemplateSettingsSchema.safeParse({ id: ID, settings: partial }).success).toBe(false);
  });
});

describe('parseStoredSettings', () => {
  it('returns null for a null column', () => {
    expect(parseStoredSettings(null)).toBeNull();
  });

  it('returns the parsed settings for a valid stored value', () => {
    expect(parseStoredSettings({ ...VALID, link_preview: { title: 'Hi' } })).toEqual({ ...VALID, link_preview: { title: 'Hi' } });
  });

  it('drops a corrupt stored value rather than surfacing it', () => {
    expect(parseStoredSettings({ password_enabled: 'yes' })).toBeNull();
  });
});

describe('resolveTemplateSettings', () => {
  it('falls back to the account settings when the template has no override', () => {
    expect(resolveTemplateSettings(VALID, null)).toEqual(VALID);
  });

  it('uses the override in full when the template has one', () => {
    const override = { ...VALID, expiry_days: 30, password_enabled: true };
    expect(resolveTemplateSettings(VALID, override)).toEqual(override);
  });
});
