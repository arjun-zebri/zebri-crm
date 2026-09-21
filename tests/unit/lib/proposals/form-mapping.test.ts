/**
 * Unit tests for the pure form <-> row mapping helpers in
 * `lib/proposals/form-mapping.ts`, focused on:
 * - `blankOption`'s default shape (fix 2: a bespoke option not sourced
 *   from a package).
 * - The round trip of a hand-built option (blank option, hand-added base
 *   item, `new-` id sentinel) through `toInput` (form -> save payload)
 *   and `fromRow` (DB row -> form), matching how a save then a reload
 *   would see it.
 */
import { describe, expect, it } from 'vitest';

import { blankOption, emptyForm } from '@/lib/proposals/form-factories';
import { fromRow, toInput, type ProposalOptionRow, type ProposalRow } from '@/lib/proposals/form-mapping';
import type { ProposalItemInput } from '@/lib/proposals/types';

describe('blankOption', () => {
  it('starts empty, itemised, GST inclusive, and not popular', () => {
    const opt = blankOption(1);
    expect(opt.title).toBe('');
    expect(opt.description).toBeNull();
    expect(opt.sourcePackageId).toBeNull();
    expect(opt.pricingMode).toBe('itemised');
    expect(opt.fixedPrice).toBeNull();
    expect(opt.gstInclusive).toBe(true);
    expect(opt.weekendLoadingPercent).toBeNull();
    expect(opt.isPopular).toBe(false);
    expect(opt.items).toEqual([]);
    expect(opt.position).toBe(1);
  });

  it('mints a unique new- id each call, matching the item id sentinel convention', () => {
    const a = blankOption(1);
    const b = blankOption(2);
    expect(a.id).toMatch(/^new-/);
    expect(a.id).not.toBe(b.id);
  });
});

describe('form-mapping round trip for a hand-built option', () => {
  const handAddedItem: ProposalItemInput = {
    id: 'new-item-1',
    description: 'Ceremony inclusion',
    note: null,
    amount: 750,
    quantity: 1,
    isAddon: false,
    defaultIncluded: true,
    position: 1,
  };

  it('toInput keeps a hand-added base item and titles a blank option', () => {
    const form = emptyForm('couple-1');
    const opt = { ...blankOption(1), items: [handAddedItem] };
    const input = toInput({ ...form, options: [opt] });

    expect(input.options).toHaveLength(1);
    // A blank title would fail the schema's min(1); toInput falls back to
    // a placeholder rather than blocking the save.
    expect(input.options[0]?.title).toBe('Untitled option');
    expect(input.options[0]?.items).toEqual([handAddedItem]);
  });

  it('fromRow reads back a saved blank option with its hand-added item', () => {
    // Models what write-options.ts persists: the client's `new-` ids are
    // discarded on insert and replaced by real DB uuids, but every other
    // field the form sent (title, pricing terms, item amounts) survives.
    const row: ProposalRow = {
      id: 'p1',
      couple_id: 'couple-1',
      event_id: null,
      title: 'Anna & Jake',
      intro_note: null,
      hero_override: null,
      expires_at: null,
      deposit_percent: 30,
      payment_schedule_id: null,
      contract_template_id: null,
      status: 'draft',
      proposal_number: 'PR-001',
      share_token: 'tok',
      share_token_enabled: false,
      email_sent_at: null,
      version: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      user_id: 'u1',
      accepted_addon_selection: null,
      accepted_at: null,
      accepted_option_id: null,
      contract_id: null,
      declined_at: null,
      declined_message: null,
      declined_reason: null,
      first_viewed_at: null,
      invoice_id: null,
      last_viewed_at: null,
      view_count: 0,
      proposal_options: [
        {
          id: 'db-opt-1',
          proposal_id: 'p1',
          user_id: 'u1',
          created_at: '2026-01-01',
          position: 1,
          title: 'Untitled option',
          description: null,
          source_package_id: null,
          pricing_mode: 'itemised',
          fixed_price: null,
          gst_inclusive: true,
          weekend_loading_percent: null,
          is_popular: false,
          subtotal: 750,
          proposal_option_items: [
            {
              id: 'db-item-1',
              option_id: 'db-opt-1',
              user_id: 'u1',
              created_at: '2026-01-01',
              description: 'Ceremony inclusion',
              note: null,
              amount: 750,
              quantity: 1,
              is_addon: false,
              default_included: true,
              position: 1,
            },
          ],
        } as ProposalOptionRow,
      ],
    } as ProposalRow;

    const form = fromRow(row);

    expect(form.options).toHaveLength(1);
    const opt = form.options[0];
    expect(opt?.title).toBe('Untitled option');
    expect(opt?.pricingMode).toBe('itemised');
    expect(opt?.gstInclusive).toBe(true);
    expect(opt?.weekendLoadingPercent).toBeNull();
    expect(opt?.items).toHaveLength(1);
    expect(opt?.items[0]).toMatchObject({
      description: 'Ceremony inclusion',
      amount: 750,
      isAddon: false,
      defaultIncluded: true,
    });
  });
});
