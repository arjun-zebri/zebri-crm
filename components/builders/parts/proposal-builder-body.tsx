'use client';

/**
 * The Details body of the proposal builder modal: who it is for, when it
 * expires, the commercial terms, and the readiness checklist. Split out of
 * `proposal-builder-modal.tsx` so that file stays an orchestrator inside
 * the repo's file-size guideline.
 *
 * What it shows depends on whether the proposal carries a Layout v2 design
 * of its own. One that does owns its note, cover and packages on that
 * design (the couple reads them there, and the option rows follow it), so
 * this surface stops offering a second editor for them and points at the
 * design instead. A legacy v1 proposal keeps every editor it always had.
 *
 * @module components/builders/parts/proposal-builder-body
 */
import { BuilderMetaRow, type CoupleOption } from '@/components/builders/parts/builder-meta-row';
import { ProposalAddonsEditor } from '@/components/builders/parts/proposal-addons-editor';
import { ProposalHeroOverride } from '@/components/builders/parts/proposal-hero-override';
import { ProposalIntroNote } from '@/components/builders/parts/proposal-intro-note';
import { ProposalOptionsEditor } from '@/components/builders/parts/proposal-options-editor';
import { ProposalPackagesFromDesign } from '@/components/builders/parts/proposal-packages-from-design';
import { ProposalReadiness } from '@/components/builders/parts/proposal-readiness';
import { ProposalTerms } from '@/components/builders/parts/proposal-terms';
import type { ApplySources } from '@/components/builders/parts/use-apply-sources';
import { applyPackageToOption } from '@/lib/proposals/form-factories';
import type { ProposalFormState } from '@/lib/proposals/form-mapping';

/** Props for {@link ProposalBuilderBody}. */
export interface ProposalBuilderBodyProps {
  form: ProposalFormState;
  update: (patch: Partial<ProposalFormState>) => void;
  /** False once the proposal is accepted: every control reads as locked. */
  canEdit: boolean;
  /** True when the proposal carries its own Layout v2 design. */
  hasLayout: boolean;
  couples: CoupleOption[] | undefined;
  coupleName: string | null;
  /** The packages library, for "apply a package" on a legacy proposal. */
  sources: ApplySources | undefined;
}

/** See {@link ProposalBuilderBodyProps}. */
export function ProposalBuilderBody({ form, update, canEdit, hasLayout, couples, coupleName, sources }: ProposalBuilderBodyProps) {
  return (
    <div className="space-y-6">
      <BuilderMetaRow
        selectedCoupleId={form.coupleId || null}
        selectedCoupleName={coupleName}
        coupleOptions={couples ?? []}
        canEditCouple={canEdit && !form.proposalId}
        onSelectCouple={(c) => update({ coupleId: c.id })}
        dateValue={form.expiresAt}
        dateLabel="Expires"
        onDateChange={(v) => update({ expiresAt: v })}
        canEdit={canEdit}
      />
      {/* The note and the cover are sections of the design on a v2
          proposal (founder review: "it should just come from the
          template"), so they are only offered for a legacy one. */}
      {hasLayout ? null : (
        <>
          <ProposalIntroNote value={form.introNote} canEdit={canEdit} onChange={(v) => update({ introNote: v })} />
          <ProposalHeroOverride
            value={form.heroOverride}
            proposalId={form.proposalId}
            canEdit={canEdit}
            onChange={(v) => update({ heroOverride: v })}
          />
        </>
      )}
      {/* A proposal with its own design edits its packages there, not
          here: two editors writing the same figures is how the couple's
          page and the invoice end up disagreeing. */}
      {hasLayout && form.proposalId ? (
        <ProposalPackagesFromDesign proposalId={form.proposalId} canEdit={canEdit} />
      ) : (
        <>
          <ProposalOptionsEditor
            options={form.options}
            sources={sources}
            canEdit={canEdit}
            onChange={(options) => update({ options })}
            onApplySource={(id) => {
              const src = sources?.applyMap[id];
              const name = sources?.options.find((o) => o.id === id)?.name ?? 'Package';
              if (!src) return;
              const hasPopular = form.options.some((o) => o.isPopular);
              update({
                options: [...form.options, applyPackageToOption(src, name, form.options.length + 1, hasPopular)],
              });
            }}
          />
          <ProposalAddonsEditor options={form.options} canEdit={canEdit} onChange={(options) => update({ options })} />
        </>
      )}
      <ProposalTerms
        depositPercent={form.depositPercent}
        paymentScheduleId={form.paymentScheduleId}
        contractTemplateId={form.contractTemplateId}
        canEdit={canEdit}
        onChange={update}
      />
      <ProposalReadiness form={form} />
    </div>
  );
}
