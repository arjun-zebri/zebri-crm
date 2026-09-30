/**
 * `/proposals/design/new`, the design editor mounted before its proposal
 * exists.
 *
 * The behaviour the founder asked for, on a real component tree: the
 * editor opens on the template's layout, nothing is written by opening it
 * or by leaving, and the explainer says out loud that the template is
 * safe. The create itself is spied on rather than run; what it does to
 * the database is `tests/integration/proposals/new-proposal-design.test.ts`.
 *
 * @module tests/unit/app/proposals/new-proposal-design
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewProposalDesign } from '@/app/(dashboard)/proposals/design/new/new-proposal-design';
import { defaultTemplateLayout, type ProposalLayout } from '@/features/proposals';
import { buildPublicBranding } from '@/lib/branding/public-branding';

const COUPLE_ID = '11111111-1111-4111-9111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-9222-222222222222';

const createProposalFromTemplateAction = vi.fn();
vi.mock('@/app/(dashboard)/proposals/create-from-template', () => ({
  createProposalFromTemplateAction: (input: unknown) => createProposalFromTemplateAction(input),
}));

// The gate reaches the template action through the feature-internal path,
// not the barrel it imports from, so the mock targets that directly.
const actions = vi.hoisted(() => ({ getTemplateAction: vi.fn(), updateProposalLayoutAction: vi.fn(), renameProposalAction: vi.fn() }));
vi.mock('@/features/proposals/data/templates', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, getTemplateAction: actions.getTemplateAction };
});
vi.mock('@/features/proposals/data/proposals', () => actions);

const branding = buildPublicBranding({ business_name: 'Sam MC' });
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding, blocks: [], brandLabel: null, loading: false }),
}));

/** The couple the editor names. `null` stands in for a couple that is gone. */
let couple: { name: string } | null = { name: 'Anna & Jake' };
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {
        maybeSingle: () => Promise.resolve({ data: couple, error: null }),
      };
      for (const method of ['select', 'eq']) chain[method] = () => chain;
      return chain;
    },
  }),
}));

// jsdom has no ResizeObserver; the canvas observes its scroll viewport.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const template = { id: TEMPLATE_ID, name: 'Signature', isDefault: true, updatedAt: '2026-09-20T00:00:00Z', settings: null, layout: defaultTemplateLayout('mc'), revision: 3 };

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NewProposalDesign templateId={TEMPLATE_ID} coupleId={COUPLE_ID} expiresAt="2027-01-31" userId="u1" />
    </QueryClientProvider>,
  );
}

const sections = (container: HTMLElement) => container.querySelectorAll('[data-canvas-section-id]');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  couple = { name: 'Anna & Jake' };
  actions.getTemplateAction.mockResolvedValue({ ok: true, template });
  actions.updateProposalLayoutAction.mockResolvedValue({ ok: true, revision: 1 });
  createProposalFromTemplateAction.mockResolvedValue({ ok: true, proposalId: 'p-new' });
});

afterEach(() => {
  // Explicit and first, for the same reason `template-editor.test.tsx`
  // does it: the autosave flushes from React's unmount cleanup, and the
  // global cleanup runs after this hook's `clearAllMocks` would have
  // reset the counts this file asserts on.
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('NewProposalDesign', () => {
  it('opens the template design for the couple without creating a proposal, and leaves nothing behind', async () => {
    const { container, unmount } = renderRoute();
    await waitFor(() => expect(sections(container).length).toBe(template.layout.sections.length));

    // Whose copy this is, in the header, on a proposal that does not exist.
    expect(screen.getByRole('button', { name: 'Rename Anna & Jake, your wedding' })).toBeInTheDocument();
    expect(createProposalFromTemplateAction).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(createProposalFromTemplateAction).not.toHaveBeenCalled());
    expect(actions.updateProposalLayoutAction).not.toHaveBeenCalled();
  });

  /**
   * The other half of the rule: a change the MC actually made has to
   * bring the row into existence, exactly once, carrying the edit.
   */
  it('creates the proposal on the first real change and saves the edit into it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { container } = renderRoute();
      await waitFor(() => expect(sections(container).length).toBe(template.layout.sections.length));
      // Dismiss the explainer first: it covers the canvas on a first open.
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

      // A directly-clickable style edit on the second section, the same
      // gesture `template-editor.test.tsx` uses for "a real edit".
      const target = template.layout.sections[1]!;
      fireEvent.click(screen.getAllByRole('button', { name: 'Move section' })[1]!);
      fireEvent.click(screen.getByRole('button', { name: 'Style' }));
      fireEvent.click(screen.getByRole('button', { name: 'Full' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });

      await waitFor(() => expect(createProposalFromTemplateAction).toHaveBeenCalledTimes(1));
      expect(createProposalFromTemplateAction).toHaveBeenCalledWith({ coupleId: COUPLE_ID, templateId: TEMPLATE_ID, expiresAt: '2027-01-31' });

      await waitFor(() => expect(actions.updateProposalLayoutAction).toHaveBeenCalledTimes(1));
      const saved = actions.updateProposalLayoutAction.mock.calls[0]![0] as { id: string; baseRevision: number; layout: ProposalLayout };
      expect(saved.id).toBe('p-new');
      // Based on the revision a brand new row starts at, not the
      // template's (which was 3).
      expect(saved.baseRevision).toBe(0);
      // The section ids are freshly minted, so the edit is matched by
      // position rather than by the template's own id.
      expect(saved.layout.sections[1]?.style.height).toBe('full');
      expect(saved.layout.sections[1]?.id).not.toBe(target.id);

      // And the URL now points at the row that exists.
      expect(window.location.pathname).toBe('/proposals/p-new/design');
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains what the editor is, once per account', async () => {
    const user = userEvent.setup();
    const { container } = renderRoute();
    await waitFor(() => expect(sections(container).length).toBeGreaterThan(0));

    const dialog = await screen.findByRole('dialog', { name: "You are editing this couple's copy" });
    expect(dialog).toHaveTextContent('Anna & Jake');
    expect(dialog).toHaveTextContent('Signature');
    expect(dialog).toHaveTextContent(/never touches the template/);

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: "You are editing this couple's copy" })).toBeNull());

    // Reopened by the same account: the reassurance has been given.
    cleanup();
    renderRoute();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: "You are editing this couple's copy" })).toBeNull();
  });

  it('sends the MC somewhere they can act when the template is gone', async () => {
    actions.getTemplateAction.mockResolvedValue({ ok: false, error: 'Template not found' });
    renderRoute();
    expect(await screen.findByText('Could not open the editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says so plainly when the couple no longer exists', async () => {
    couple = null;
    renderRoute();
    expect(await screen.findByText('Nothing to edit here')).toBeInTheDocument();
  });
});
