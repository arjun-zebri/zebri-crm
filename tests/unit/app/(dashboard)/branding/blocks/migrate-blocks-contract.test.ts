/**
 * Unit tests for `migrateBlocks(blocks, 'contract')` — locks the
 * Phase 3.1 contract-surface migration behaviour against
 * regressions.
 *
 * Why this matters: the migration runs on every read of contract
 * branding blocks, so a subtle change to the heuristic (or to the
 * old default's text shape) could either:
 *   - silently fail to strip the legacy body content → couples see
 *     duplicated text on `/contract/[token]`
 *   - over-eagerly strip a custom user block → MC loses chrome they
 *     deliberately wrote
 * Both are bad for trust. Tests pin the boundary.
 */
import { describe, expect, it } from 'vitest';

import { migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults';
import type { Block } from '@/app/(dashboard)/branding/blocks/types';

/** Reconstructed shape of the OLD contract default (pre-Phase-3.1).
 *  Captures the distinctive headings the migration looks for so
 *  the test is self-contained and doesn't drift if the default
 *  itself ever changes. */
const oldContractDefault: Block[] = [
  { id: 'hb_1', type: 'headerBanner' },
  { id: 'bn_1', type: 'businessName' },
  {
    id: 'tt_1',
    type: 'title',
    title: 'Wedding MC Service Agreement',
    subtitle: 'ALEX & JORDAN  ·  14 SEPTEMBER 2026',
    showRef: true,
    showExpires: false,
    showAbn: true,
  },
  {
    id: 'tx_1',
    type: 'text',
    text: 'PARTIES\n\nMC: [Your business name]...',
  },
  {
    id: 'tx_2',
    type: 'text',
    text: 'EVENT DETAILS\n\nDate: Saturday, 14 September 2026...',
  },
  { id: 'dv_1', type: 'divider' },
  {
    id: 'tx_3',
    type: 'text',
    text: '1. SERVICES\n\nThe MC will host the ceremony...',
  },
  {
    id: 'tx_4',
    type: 'text',
    text: '2. EQUIPMENT & TECHNICAL REQUIREMENTS\n\nThe MC will arrive...',
  },
  {
    id: 'tx_5',
    type: 'text',
    text: '3. FEES & PAYMENT SCHEDULE\n\nThe total fee...',
  },
  { id: 'dv_2', type: 'divider' },
  {
    id: 'tx_6',
    type: 'text',
    text: 'SIGNATURES\n\nBy clicking "Sign contract" below...',
  },
  {
    id: 'ac_1',
    type: 'action',
    primary: 'Sign contract',
    secondary: null,
  },
  { id: 'ft_1', type: 'footer', closingNote: 'A counter-signed copy will be returned to you.' },
];

describe('migrateBlocks — contract surface', () => {
  it('inserts a contractBody marker when migrating the old default', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    expect(result.some((b) => b.type === 'contractBody')).toBe(true);
  });

  it('strips body-content text blocks matching the old template headings', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    // Every original text block in oldContractDefault has an old-
    // template heading; all six should be gone.
    const textBlocks = result.filter((b) => b.type === 'text');
    expect(textBlocks).toHaveLength(0);
  });

  it('preserves chrome blocks (headerBanner, businessName, title, footer)', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    expect(result.find((b) => b.type === 'headerBanner')).toBeDefined();
    expect(result.find((b) => b.type === 'businessName')).toBeDefined();
    expect(result.find((b) => b.type === 'title')).toBeDefined();
    expect(result.find((b) => b.type === 'footer')).toBeDefined();
  });

  it('drops the "Sign contract" action block (semantically tied to the stripped body)', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    expect(result.find((b) => b.type === 'action')).toBeUndefined();
  });

  it('drops residual dividers that previously bracketed the stripped body', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    // The two dividers in oldContractDefault both sat between
    // adjacent text blocks; after the text blocks are removed
    // they're stranded. The cleanup should drop them.
    expect(result.find((b) => b.type === 'divider')).toBeUndefined();
  });

  it('inserts the marker AFTER the title block', () => {
    const result = migrateBlocks(oldContractDefault, 'contract');
    const titleIdx = result.findIndex((b) => b.type === 'title');
    const markerIdx = result.findIndex((b) => b.type === 'contractBody');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(markerIdx).toBe(titleIdx + 1);
  });

  it('preserves custom user-added text blocks that do NOT match the old-default heading pattern', () => {
    const customised: Block[] = [
      { id: 'hb_1', type: 'headerBanner' },
      { id: 'bn_1', type: 'businessName' },
      // A custom intro block the MC wrote. Lowercase + casual —
      // doesn't trip the regex. (No em-dash in the body text:
      // `stripDashes` would normalise it to a hyphen during
      // migration, which is a separate concern from the contract-
      // body stripping logic this test pins.)
      {
        id: 'tx_custom1',
        type: 'text',
        text: 'Thanks for choosing us - here\'s the agreement we discussed.',
      },
      // Old-default text block — should be stripped.
      {
        id: 'tx_old',
        type: 'text',
        text: 'PARTIES\n\nMC: [Your business name]...',
      },
      // Another custom block — should survive.
      {
        id: 'tx_custom2',
        type: 'text',
        text: 'Reach out any time if you have questions.',
      },
    ];
    const result = migrateBlocks(customised, 'contract');
    // Text blocks now store rich-text JSON, so read their plain text to assert
    // which survived. The migration behaviour (strip old-default, keep custom)
    // is unchanged; only the field representation moved from string to JSON.
    const plain = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (!value || typeof value !== 'object') return '';
      const node = value as { text?: string; content?: unknown[] };
      if (typeof node.text === 'string') return node.text;
      return Array.isArray(node.content) ? node.content.map(plain).join('') : '';
    };
    const texts = result
      .filter((b): b is Block & { type: 'text' } => b.type === 'text')
      .map((b) => plain(b.text));
    expect(texts).toContain(
      'Thanks for choosing us - here\'s the agreement we discussed.',
    );
    expect(texts).toContain('Reach out any time if you have questions.');
    expect(texts.some((t) => t.startsWith('PARTIES'))).toBe(false);
  });

  it('is idempotent — running migrateBlocks twice yields the same shape', () => {
    const once = migrateBlocks(oldContractDefault, 'contract');
    const twice = migrateBlocks(once, 'contract');
    expect(twice.map((b) => b.type)).toEqual(once.map((b) => b.type));
    // Marker count stays at 1 — second pass detects the existing
    // marker and short-circuits.
    expect(twice.filter((b) => b.type === 'contractBody')).toHaveLength(1);
  });

  it('leaves an already-migrated tree untouched (no false strips)', () => {
    const alreadyMigrated: Block[] = [
      { id: 'hb_1', type: 'headerBanner' },
      { id: 'bn_1', type: 'businessName' },
      { id: 'cb_1', type: 'contractBody', locked: true },
      { id: 'ft_1', type: 'footer' },
    ];
    const result = migrateBlocks(alreadyMigrated, 'contract');
    expect(result.map((b) => b.type)).toEqual([
      'headerBanner',
      'businessName',
      'contractBody',
      'footer',
    ]);
  });

  it('does not touch non-contract surfaces', () => {
    // Quote / invoice surfaces should NOT have the contract-body
    // injection applied even if they contain text blocks matching
    // the old contract heading pattern (vanishingly unlikely but
    // worth pinning).
    const quoteWithLookalike: Block[] = [
      { id: 'hb_1', type: 'headerBanner' },
      {
        id: 'tx_1',
        type: 'text',
        text: 'PARTIES\n\nThis is a quote that happens to start with PARTIES.',
      },
    ];
    const result = migrateBlocks(quoteWithLookalike, 'proposal');
    expect(result.find((b) => b.type === 'contractBody')).toBeUndefined();
    expect(result.find((b) => b.type === 'text')).toBeDefined();
  });
});
