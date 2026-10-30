/**
 * Unit tests for the Send a proposal modal: the founder's flow is "select
 * couple and a preview comes up where you can hit send or make edits and
 * then send", so what has to hold is that Send says why it is off, that
 * choosing a couple turns it on, that "Make edits" opens the design
 * editor without creating anything, and that a failed send never mints
 * the couple a second proposal.
 *
 * The preview pane is stubbed: `ProposalLayoutView` is covered by the
 * feature's own tests and is heavy in jsdom.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const COUPLE_ID = '11111111-1111-4111-9111-111111111111';
const NO_EMAIL_COUPLE_ID = '33333333-3333-4333-9333-333333333333';
const TEMPLATE_ID = '22222222-2222-4222-9222-222222222222';
const PROPOSAL_ID = '44444444-4444-4444-9444-444444444444';

const createProposalFromTemplateAction = vi.fn();
vi.mock('@/app/(dashboard)/proposals/create-from-template', () => ({
  createProposalFromTemplateAction: (input: unknown) => createProposalFromTemplateAction(input),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('@/components/builders/parts/send-proposal-preview', () => ({
  SendProposalPreview: () => <div data-testid="preview" />,
}));

const template = {
  id: TEMPLATE_ID,
  name: 'My proposal',
  isDefault: true,
  updatedAt: '2026-09-01T00:00:00.000Z',
  settings: null,
  layout: { version: 2 as const, sections: [] },
};

vi.mock('@/app/(dashboard)/proposals/templates/use-proposal-templates', () => ({
  useProposalTemplates: () => ({ data: [template], isPending: false, error: null, refetch: vi.fn() }),
}));

vi.mock('@/features/proposals', () => ({
  getProposalSettingsAction: () =>
    Promise.resolve({ ok: true, settings: { password_enabled: false, allow_download: true, expiry_days: 14, deposit_percent: 25, link_preview: null } }),
}));

vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding: {}, blocks: [], brandLabel: null, loading: false }),
}));

vi.mock('@/lib/supabase/current-user', () => ({ getCurrentUser: () => Promise.resolve({ id: 'u1' }) }));

/** How many contract templates the account has; a test flips it to 0 to prove the blocked reason. */
let contractTemplateCount = 1;

const couples = [
  { id: COUPLE_ID, name: 'Amy & Ben', primary_email: 'amy@example.com', email: null, event_date: '2027-03-20', venue: 'The Barn' },
  { id: NO_EMAIL_COUPLE_ID, name: 'Cara & Dev', primary_email: null, email: null, event_date: null, venue: null },
];

// Two tables are read through this client: `couples` (the picker) and
// `contract_templates` (a head count, since the send route refuses a
// proposal with no contract template). The chain resolves to whichever
// shape the table expects.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const result =
        table === 'contract_templates' ? { data: null, count: contractTemplateCount, error: null } : { data: couples, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      };
      for (const method of ['select', 'eq', 'order']) chain[method] = () => chain;
      return chain;
    },
  }),
}));

const { SendProposalModal } = await import('@/components/builders/send-proposal-modal');

function renderModal(props: { initialCoupleId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SendProposalModal isOpen onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

const sendButton = () => screen.getByRole('button', { name: 'Send to couple' });

beforeEach(() => {
  contractTemplateCount = 1;
  createProposalFromTemplateAction.mockReset();
  createProposalFromTemplateAction.mockResolvedValue({ ok: true, proposalId: PROPOSAL_ID });
  push.mockReset();
  toast.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
});

describe('SendProposalModal', () => {
  it('says why Send is off and wires the reason to the button', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByTestId('preview')).toBeInTheDocument());

    // The reason only appears once the modal knows there is nothing
    // chosen, not while the couples list is still in flight: a
    // preselected couple would otherwise flash a reason that is not true.
    const reason = await screen.findByText('Choose a couple first');
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveAttribute('aria-describedby', reason.id);
  });

  it('enables Send once a couple with an email address is chosen', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /Select couple/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Select couple/ }));
    await user.click(await screen.findByRole('button', { name: 'Amy & Ben' }));

    await waitFor(() => expect(sendButton()).not.toBeDisabled());
    expect(screen.queryByText('Choose a couple first')).toBeNull();
    expect(sendButton()).not.toHaveAttribute('aria-describedby');
  });

  it('blocks Send when the account has no contract template to close with', async () => {
    contractTemplateCount = 0;
    renderModal({ initialCoupleId: COUPLE_ID });
    expect(await screen.findByText('Add a contract template in Templates first')).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    // "Make edits" is still open: a contract template is a send-time
    // requirement, and the MC can add one before coming back.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make edits' })).not.toBeDisabled());
  });

  it('names the couple when they have no email address to send to', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: /Select couple/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Select couple/ }));
    await user.click(await screen.findByRole('button', { name: 'Cara & Dev' }));

    await waitFor(() => expect(screen.getByText('Cara & Dev has no email address yet')).toBeInTheDocument());
    expect(sendButton()).toBeDisabled();
  });

  /**
   * The founder's report, 2026-09-23: "Clicking make edits works but it
   * increases the proposal count when youve quit out of it." Nothing may
   * be written until the MC actually changes something, so this button is
   * now a link and nothing more.
   */
  it('"Make edits" opens the design editor without creating a proposal', async () => {
    const user = userEvent.setup();
    renderModal({ initialCoupleId: COUPLE_ID });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make edits' })).not.toBeDisabled());

    await user.click(screen.getByRole('button', { name: 'Make edits' }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(createProposalFromTemplateAction).not.toHaveBeenCalled();

    const href = new URL(String(push.mock.calls[0]![0]), 'https://app.test');
    expect(href.pathname).toBe('/proposals/design/new');
    expect(href.searchParams.get('couple')).toBe(COUPLE_ID);
    expect(href.searchParams.get('template')).toBe(TEMPLATE_ID);
    // The expiry the modal settled on rides along, so the row the editor
    // eventually creates carries what the MC saw in the preview.
    expect(href.searchParams.get('expires')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sends the proposal it just created and reports it', async () => {
    const user = userEvent.setup();
    renderModal({ initialCoupleId: COUPLE_ID });
    await waitFor(() => expect(sendButton()).not.toBeDisabled());

    await user.click(sendButton());

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Proposal sent', 'success'));
    expect(fetch).toHaveBeenCalledWith('/api/email/send-proposal', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({ proposalId: PROPOSAL_ID });
  });

  it('retries the email on the draft it already made instead of creating a second proposal', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Resend is down' }) })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    renderModal({ initialCoupleId: COUPLE_ID });
    await waitFor(() => expect(sendButton()).not.toBeDisabled());

    await user.click(sendButton());
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Resend is down', 'error'));

    await user.click(sendButton());
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Proposal sent', 'success'));

    expect(createProposalFromTemplateAction).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
