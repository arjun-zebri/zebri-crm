/**
 * @module tests/unit/app/proposals/proposal-settings-model
 */
import { describe, expect, it } from 'vitest';

import { fromDraft, toDraft, type ProposalSettingsDraft } from '@/app/(dashboard)/proposals/proposal-settings-model';
import type { ProposalSettings } from '@/features/proposals';

const SETTINGS: ProposalSettings = {
  password_enabled: true,
  allow_download: false,
  expiry_days: 21,
  deposit_percent: 25,
  link_preview: { title: 'A wedding proposal', imageUrl: 'https://example.com/preview.png' },
};

describe('toDraft', () => {
  it('flattens link_preview into two string fields', () => {
    expect(toDraft(SETTINGS)).toEqual({
      password_enabled: true,
      allow_download: false,
      expiry_days: 21,
      deposit_percent: 25,
      linkPreviewTitle: 'A wedding proposal',
      linkPreviewImageUrl: 'https://example.com/preview.png',
    });
  });

  it('defaults both link preview fields to empty strings when null', () => {
    const draft = toDraft({ ...SETTINGS, link_preview: null });
    expect(draft.linkPreviewTitle).toBe('');
    expect(draft.linkPreviewImageUrl).toBe('');
  });
});

describe('fromDraft', () => {
  const draft: ProposalSettingsDraft = {
    password_enabled: false,
    allow_download: true,
    expiry_days: 14,
    deposit_percent: 30,
    linkPreviewTitle: '',
    linkPreviewImageUrl: '',
  };

  it('collapses two blank link preview fields to null', () => {
    expect(fromDraft(draft).link_preview).toBeNull();
  });

  it('trims and keeps only the fields that were filled in', () => {
    const result = fromDraft({ ...draft, linkPreviewTitle: '  My proposal  ', linkPreviewImageUrl: '' });
    expect(result.link_preview).toEqual({ title: 'My proposal' });
  });

  it('round-trips both link preview fields when both are filled in', () => {
    const result = fromDraft({
      ...draft,
      linkPreviewTitle: 'A wedding proposal',
      linkPreviewImageUrl: 'https://example.com/preview.png',
    });
    expect(result.link_preview).toEqual({ title: 'A wedding proposal', imageUrl: 'https://example.com/preview.png' });
  });
});
