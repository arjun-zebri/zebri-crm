/**
 * The couple tab header at phone width (Phase 5 live check B3, B4).
 *
 * At 390px the actions row was `shrink-0` beside a `min-w-0` title, so
 * the title and its stat line collapsed to 0px: "1 partly failed" on the
 * Workflow tab and "2 not delivered" on the Emails tab could not be
 * seen. jsdom does no layout, so this pins the classes that decide it:
 * below `sm` the header stacks, the stat line wraps instead of cutting
 * off, and the actions wrap onto more lines rather than overflow.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoupleTabShell } from '@/app/(dashboard)/couples/couple-tab-shell';
import { Button } from '@/components/ui/button';

function renderShell() {
  render(
    <CoupleTabShell
      title="Workflow"
      stats={[{ label: '2 open' }, { label: '1 partly failed', tone: 'warning' }]}
      actions={
        <>
          <Button>Stop everything</Button>
          <Button>Start a workflow</Button>
          <Button>Add a to-do</Button>
        </>
      }
    >
      <p>body</p>
    </CoupleTabShell>,
  );
}

describe('CoupleTabShell header', () => {
  it('stacks below sm, so the actions never squeeze the title to nothing', () => {
    renderShell();
    const header = screen.getByRole('heading', { name: 'Workflow' }).closest('header');
    expect(header).not.toBeNull();
    const cls = header!.className.split(/\s+/);
    expect(cls).toContain('flex-col');
    expect(cls).toContain('sm:flex-row');
  });

  it('wraps the stat line rather than truncating it', () => {
    renderShell();
    const line = screen.getByText('1 partly failed').closest('p');
    expect(line).not.toBeNull();
    expect(line!.className).not.toMatch(/\btruncate\b/);
    expect(line!.className).toMatch(/\bbreak-words\b/);
  });

  it('lets the actions wrap and only holds them unshrunk from sm up', () => {
    renderShell();
    const actions = screen.getByRole('button', { name: 'Add a to-do' }).parentElement!;
    const cls = actions.className.split(/\s+/);
    expect(cls).toContain('flex-wrap');
    expect(cls).not.toContain('shrink-0');
    expect(cls).toContain('sm:shrink-0');
    // Each action keeps its one-line width and moves to the next line
    // instead: shrunk, "Start a workflow" broke onto two lines inside a
    // 32px button at 390px.
    expect(cls).toContain('*:shrink-0');
  });
});
