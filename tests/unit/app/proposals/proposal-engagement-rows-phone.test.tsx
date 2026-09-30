/**
 * Phone layout of the drill-down rows, pinned after the R4 live check at
 * 390px: with a fixed label, figures and pill on one line, every bar
 * rendered 0px wide and the "Chosen" pill ran off the screen. jsdom has no
 * layout, so these assert the classes that produce the fix: the row wraps
 * below `sm`, the bar takes its own full-width line there, and the pill
 * column is wide enough for the pill.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposalPackageComparison } from '@/app/(dashboard)/proposals/[id]/proposal-package-comparison';
import { ProposalSectionEngagement } from '@/app/(dashboard)/proposals/[id]/proposal-section-engagement';

/** The bar track: the row's child that holds the filled bar. */
function barTrack(row: HTMLElement): HTMLElement {
  const track = [...row.children].find((c) => c.firstElementChild?.classList.contains('bg-brand-fg'));
  if (!(track instanceof HTMLElement)) throw new Error('no bar track in row');
  return track;
}

function expectPhoneWrap(row: HTMLElement) {
  expect(row.className).toContain('flex-wrap');
  expect(row.className).toContain('sm:flex-nowrap');
  const track = barTrack(row);
  // Full width on its own line below `sm`, back inline as the flexible column above it.
  expect(track.className).toContain('w-full');
  expect(track.className).toContain('order-last');
  expect(track.className).toContain('sm:flex-1');
}

describe('drill-down rows at phone width', () => {
  it('section rows wrap so the bar is never squeezed to nothing', () => {
    render(<ProposalSectionEngagement rows={[{ id: 's1', label: 'Hero', seconds: 5, reachPct: 100 }]} sessions={1} />);
    expectPhoneWrap(screen.getByText('Hero').parentElement!);
  });

  it('package rows wrap, and the pill column fits the Chosen pill', () => {
    render(
      <ProposalPackageComparison
        rows={[{ optionId: 'o1', title: 'Full day', views: 1, seconds: 7, chosenBy: 'accepted' }]}
      />,
    );
    const row = screen.getByText('Full day').parentElement!;
    expectPhoneWrap(row);
    const pillCell = screen.getByText('Chosen').closest('span.shrink-0');
    expect(pillCell?.className).toContain('w-24');
  });
});
