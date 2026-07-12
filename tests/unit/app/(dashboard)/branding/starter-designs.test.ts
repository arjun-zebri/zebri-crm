/**
 * Unit tests for the curated starter designs — pins the layout "mood"
 * transforms so a design keeps setting the layout it promises.
 *
 * Why this matters: applying a starter design overwrites the block tree
 * on every surface, so a regression in the mood transform would silently
 * ship the wrong layout (e.g. a banner the design meant to hide) the next
 * time an MC picks that design. These tests lock the intended tweaks and
 * that every surface stays non-empty with its fixed core intact.
 */
import { describe, expect, it } from 'vitest';

import {
  STARTER_DESIGNS,
  starterLayout,
} from '@/app/(dashboard)/branding/starter-designs';

describe('starter designs', () => {
  it('every design uses a known theme + mood', () => {
    const moods = ['clean', 'statement', 'framed', 'editorial'];
    for (const d of STARTER_DESIGNS) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(moods).toContain(d.mood);
    }
  });

  it('clean mood hides the banner and keeps the fixed proposal core', () => {
    const blocks = starterLayout('clean', 'proposal');
    const banner = blocks.find((b) => b.type === 'headerBanner');
    expect(banner?.hidden).toBe(true);
    // The fixed core marker must survive the transform, still locked.
    const core = blocks.find((b) => b.type === 'proposalBody');
    expect(core?.locked).toBe(true);
  });

  it('statement mood enlarges the banner and left-aligns the action', () => {
    const blocks = starterLayout('statement', 'proposal');
    const banner = blocks.find((b) => b.type === 'headerBanner');
    expect(banner && banner.type === 'headerBanner' && banner.height).toBe('lg');
    const action = blocks.find((b) => b.type === 'action');
    expect(action && action.type === 'action' && action.buttonJustify).toBe('start');
  });

  it('framed mood borders the footer', () => {
    const blocks = starterLayout('framed', 'invoice');
    const footer = blocks.find((b) => b.type === 'footer');
    expect(footer?.borderWidth).toBe(1);
  });

  it('produces a non-empty layout for every surface', () => {
    for (const surface of ['proposal', 'invoice', 'contract', 'portal'] as const) {
      expect(starterLayout('clean', surface).length).toBeGreaterThan(0);
    }
  });
});
