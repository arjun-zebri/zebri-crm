import { PrimitivesEditors } from './primitives-editors';
import { PrimitivesFeedback } from './primitives-feedback';
import { PrimitivesForms } from './primitives-forms';
import { PrimitivesLayout } from './primitives-layout';
import { PrimitivesOverlays } from './primitives-overlays';
import { Section } from './showroom';

/**
 * Primitives section: everything in `components/ui/`.
 *
 * Orchestrator only. The four groups live in their own modules so no
 * single file carries the whole 24-component matrix.
 *
 * @module app/design-system/section-primitives
 */
export function SectionPrimitives() {
  return (
    <>
      <Section
        id="layout"
        title="Primitives · Layout"
        description="PageHeader and Card, extracted from markup that every page used to hand-write."
      >
        <PrimitivesLayout />
      </Section>

      <Section
        id="forms"
        title="Primitives · Form controls"
        description="Button, Input, Select, Checkbox and DatePicker, with every variant and size rendered."
      >
        <PrimitivesForms />
      </Section>

      <Section
        id="feedback"
        title="Primitives · Feedback"
        description="Status chips, the loading / empty / error triad, toasts and tooltips."
      >
        <PrimitivesFeedback />
      </Section>

      <Section
        id="overlays"
        title="Primitives · Overlays"
        description="Modal, SidePanel, ConfirmDialog and RowActionsMenu. Open each one to compare them directly."
      >
        <PrimitivesOverlays />
      </Section>

      <Section
        id="editors"
        title="Primitives · Editors and pickers"
        description="Rich text, signature, colour, address autocomplete and audio playback."
      >
        <PrimitivesEditors />
      </Section>
    </>
  );
}
