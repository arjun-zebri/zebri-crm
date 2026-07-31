/**
 * Unit tests for the contract builder's "new draft" path.
 *
 * The Contracts tab's New button used to sit behind a couple-picker
 * popover that inserted a row before the modal ever opened. Now New
 * opens the builder directly on an unsaved draft and the couple is
 * chosen inside it, so these tests pin: the picker is populated and
 * editable while unsaved, Send is blocked until a couple is chosen,
 * and the first save creates (contractId null) rather than updates.
 *
 * The TipTap body editor and the preview pane are stubbed — neither
 * is under test here and both are heavy in jsdom.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveContractAction = vi.fn();

vi.mock('@/app/(dashboard)/payments/actions', () => ({
  saveContractAction: (...args: unknown[]) => saveContractAction(...args),
  revokeContractAction: vi.fn(),
  deleteContractAction: vi.fn(),
}));

vi.mock('@/components/builders/parts/contract-body-editor', () => ({
  ContractBodyEditor: () => <div data-testid="body-editor" />,
}));

vi.mock('@/components/builders/parts/builder-preview-pane', () => ({
  BuilderPreviewPane: () => <div data-testid="preview-pane" />,
}));

const couples = [
  { id: '11111111-1111-4111-9111-111111111111', name: 'Amy & Ben' },
  { id: '22222222-2222-4222-9222-222222222222', name: 'Cara & Dev' },
];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: 'u1', app_metadata: {}, user_metadata: {} } },
        }),
    },
    from: (table: string) => {
      // Only the couples list matters here; every other table the modal
      // touches (events, contract_templates) resolves empty.
      const rows = table === 'couples' ? couples : [];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      };
      for (const method of ['select', 'eq', 'order', 'limit']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.single = () => Promise.resolve({ data: null, error: null });
      return chain;
    },
  }),
}));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));

// Imported after the mocks so the modal picks them up.
const { ContractBuilderModal } = await import('@/components/builders/contract-builder-modal');

function renderNewDraft() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ContractBuilderModal contractId={null} isOpen onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

async function pickCouple(name: string) {
  await userEvent.click(screen.getByRole('button', { name: /Select couple/ }));
  await userEvent.click(await screen.findByRole('button', { name }));
}

describe('ContractBuilderModal — new draft', () => {
  beforeEach(() => {
    saveContractAction.mockReset().mockResolvedValue({
      ok: true,
      data: { id: '33333333-3333-4333-9333-333333333333' },
    });
    toast.mockReset();
  });

  it('opens with no couple selected and an enabled picker', async () => {
    renderNewDraft();
    expect(await screen.findByRole('button', { name: /Select couple/ })).toBeEnabled();
  });

  it('lists the user’s couples in the picker', async () => {
    renderNewDraft();
    await userEvent.click(await screen.findByRole('button', { name: /Select couple/ }));
    expect(await screen.findByRole('button', { name: 'Amy & Ben' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cara & Dev' })).toBeInTheDocument();
  });

  it('blocks Send until a couple is chosen', async () => {
    renderNewDraft();
    expect(await screen.findByRole('button', { name: /Send to couple/ })).toBeDisabled();
    await pickCouple('Amy & Ben');
    expect(screen.getByRole('button', { name: /Send to couple/ })).toBeEnabled();
  });

  it('saves as a create — null contractId with the chosen coupleId', async () => {
    renderNewDraft();
    await pickCouple('Amy & Ben');

    // Choosing the couple is itself an edit, so Save is live.
    await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(saveContractAction).toHaveBeenCalledTimes(1));
    expect(saveContractAction).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: null,
        coupleId: couples[0]!.id,
      }),
    );
  });

  it('locks the couple picker once the draft has been saved', async () => {
    renderNewDraft();
    await pickCouple('Amy & Ben');
    await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    // The saved id is adopted, so the contract is now bound to its couple.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Amy & Ben/ })).toBeDisabled(),
    );
  });
});
