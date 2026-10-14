import { describe, expect, it } from 'vitest';

import { activityScore, evaluateActivity, needsInstagramLookup, type ActivityInputs } from '@/lib/outreach/score';

const NOW = new Date('2026-10-11T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const base: ActivityInputs = {
  siteStatus: 'no_site',
  siteLatestYear: null,
  siteHasWeddingContent: null,
  hasInstagramHandle: false,
  igStatus: null,
  igLastPostAt: null,
  igFollowers: null,
};

describe('evaluateActivity', () => {
  it('is active on a recent IG post even with no website', () => {
    const r = evaluateActivity({ ...base, hasInstagramHandle: true, igStatus: 'ok', igLastPostAt: daysAgo(100) }, NOW);
    expect(r).toMatchObject({ verdict: 'active', reason: 'ig_recent' });
  });

  it('is active on a live site mentioning last year', () => {
    const r = evaluateActivity({ ...base, siteStatus: 'live', siteLatestYear: 2025 }, NOW);
    expect(r).toMatchObject({ verdict: 'active', reason: 'site_current' });
  });

  it('is active on a live site with wedding content but an old year', () => {
    expect(evaluateActivity({ ...base, siteStatus: 'live', siteLatestYear: 2018, siteHasWeddingContent: true }, NOW).verdict).toBe('active');
  });

  it('needs review when a check could not answer', () => {
    expect(evaluateActivity({ ...base, siteStatus: 'timeout' }, NOW).verdict).toBe('needs_review');
    // Handle known but IG never looked up (e.g. monthly cap hit).
    expect(evaluateActivity({ ...base, siteStatus: 'dead_dns', hasInstagramHandle: true }, NOW).verdict).toBe('needs_review');
  });

  it('is inactive with no presence, a dead site, or a stale IG', () => {
    expect(evaluateActivity(base, NOW)).toMatchObject({ verdict: 'inactive', reason: 'no_presence' });
    expect(evaluateActivity({ ...base, siteStatus: 'parked' }, NOW)).toMatchObject({ verdict: 'inactive', reason: 'site_dead' });
    expect(evaluateActivity({ ...base, siteStatus: 'dead_dns', hasInstagramHandle: true, igStatus: 'ok', igLastPostAt: daysAgo(400) }, NOW).verdict).toBe('inactive');
  });
});

describe('activityScore', () => {
  it('ranks a busy celebrant above a quiet one and caps at 100', () => {
    const busy = activityScore({ ...base, siteStatus: 'live', siteLatestYear: 2026, siteHasWeddingContent: true, hasInstagramHandle: true, igLastPostAt: daysAgo(5), igFollowers: 50_000 }, NOW);
    const quiet = activityScore({ ...base, siteStatus: 'live', siteLatestYear: 2019 }, NOW);
    expect(busy).toBe(100);
    expect(quiet).toBe(20);
  });
});

describe('needsInstagramLookup', () => {
  it('skips paid lookups when the website already settles it', () => {
    expect(needsInstagramLookup({ siteStatus: 'live', siteLatestYear: 2026, siteHasWeddingContent: true, hasInstagramHandle: true }, NOW)).toBe(false);
    expect(needsInstagramLookup({ siteStatus: 'dead_dns', siteLatestYear: null, siteHasWeddingContent: null, hasInstagramHandle: true }, NOW)).toBe(true);
    expect(needsInstagramLookup({ siteStatus: 'dead_dns', siteLatestYear: null, siteHasWeddingContent: null, hasInstagramHandle: false }, NOW)).toBe(false);
  });
});
