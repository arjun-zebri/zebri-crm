/**
 * Regression for ZEB-127: the closed dock's invisible row sat over the
 * couples-list pagination and ate clicks on page 3, Next and the
 * page-size picker. jsdom does no hit-testing, so these pin the
 * pointer-events contract that keeps the row click-through instead.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssistantDock, type AssistantDockProps } from '@/components/assistant/assistant-dock';

function renderDock(overrides: Partial<AssistantDockProps> = {}) {
  render(
    <AssistantDock
      menuOpen={false}
      onToggleMenu={vi.fn()}
      chatOpen={false}
      onToggleChat={vi.fn()}
      onFeedback={vi.fn()}
      hasChat
      {...overrides}
    />,
  );
}

/** The `<span>` wrapper `DockButton` puts around each menu button. */
function wrapperOf(name: string) {
  return screen.getByRole('button', { name, hidden: true }).parentElement!;
}

describe('AssistantDock', () => {
  it('lets clicks pass through the row, around the round button', () => {
    renderDock();
    const toggle = screen.getByRole('button', { name: 'Open Zebri menu' });
    const row = toggle.parentElement!;

    expect(row).toHaveClass('pointer-events-none');
    expect(toggle).toHaveClass('pointer-events-auto');
  });

  it('keeps the hidden menu buttons click-through while closed', () => {
    renderDock();

    expect(wrapperOf('Send feedback')).toHaveClass('pointer-events-none');
    expect(wrapperOf('Zebri AI')).toHaveClass('pointer-events-none');
  });

  it('makes the menu buttons clickable once the menu is open', () => {
    renderDock({ menuOpen: true });

    expect(wrapperOf('Send feedback')).toHaveClass('pointer-events-auto');
    expect(wrapperOf('Zebri AI')).toHaveClass('pointer-events-auto');
  });
});
