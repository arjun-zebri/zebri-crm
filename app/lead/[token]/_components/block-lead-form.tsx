/**
 * Block-driven public lead form. Renders the MC's saved `lead` surface block
 * tree in order: `formField` blocks become live controlled controls, the
 * `formSubmit` block becomes the live submit button, and any other block
 * (businessName, text, image, divider, spacer, tagline, footer) renders as
 * static chrome through {@link PublicBlockRenderer}. Field answers are mapped
 * into the submit payload by {@link buildLeadPayload}; required fields gate
 * submission via {@link requiredFieldIds}.
 *
 * @module app/lead/[token]/_components/block-lead-form
 */
'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { Block, FormFieldBlock, FormSubmitBlock } from '@/app/(dashboard)/branding/blocks/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RenderFormSubmitButton } from '@/lib/branding/public-blocks/form-submit';
import { pad } from '@/lib/branding/public-blocks/shared';
import { BlockOuter, PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer';
import { buildLeadPayload, requiredFieldIds, successRedirectUrl } from '@/lib/lead-capture/block-fields';

import type { PublicLeadForm } from './public-lead-form';

type SubmitState = 'ready' | 'submitting' | 'success' | 'error';

// A lead form carries no invoice-style document data, so the static blocks
// (businessName, text, …) render against an empty doc; their content comes from
// branding, not from a couple's document.
const EMPTY_DOC: PublicDocData = {
  title: '',
  refNumber: '',
  expiresAt: null,
  items: [],
  subtotal: 0,
  taxRate: 0,
};

/** The block-tree public enquiry form. See the module doc for the render model. */
export function BlockLeadForm({
  token,
  form,
  blocks,
}: {
  token: string;
  form: PublicLeadForm;
  blocks: Block[];
}) {
  const [state, setState] = useState<SubmitState>('ready');
  // Stamped on mount (client only) so the submit route can measure fill time.
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [hp, setHp] = useState(''); // honeypot

  const setValue = (id: string) => (v: string) =>
    setValues((s) => ({ ...s, [id]: v }));

  const required = requiredFieldIds(blocks);
  const canSubmit =
    required.every((id) => (values[id] ?? '').trim() !== '') && state !== 'submitting';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState('submitting');
    try {
      const res = await fetch('/api/lead/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          ...buildLeadPayload(blocks, values),
          hp,
          rendered_at: renderedAt.current,
        }),
      });
      if (res.ok) {
        // Redirect mode sends the couple to the MC's own thank-you page.
        // Navigate the TOP window: the form usually lives in an iframe embed,
        // and a thank-you page inside the iframe would defeat its purpose
        // (conversion pixels, page layout). Cross-origin top navigation is
        // permitted from an unsandboxed iframe; if anything blocks it we fall
        // through to the success message.
        const redirect = successRedirectUrl(blocks);
        if (redirect) {
          try {
            (window.top ?? window).location.href = redirect;
          } catch {
            window.location.href = redirect;
          }
        }
        setState('success');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    const submitBlock = blocks.find((b): b is FormSubmitBlock => b.type === 'formSubmit');
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-text">Thank you</h2>
        <p className="text-body text-text-muted mt-2">
          {submitBlock?.successMessage || 'Your enquiry has been sent. They will be in touch soon.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Honeypot: hidden from humans, catnip for bots. */}
      <div className="hidden" aria-hidden="true">
        <Input
          label=""
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      {blocks
        .filter((b) => !b.hidden)
        .map((block) => {
          if (block.type === 'formField') {
            return (
              <BlockOuter key={block.id} block={block} branding={form}>
                {/* Vertical rhythm lives inside each public block: fields get
                    the density blockY, matching the editor preview's spacing. */}
                <div className={pad(form).blockY}>
                  <FormFieldControl block={block} value={values[block.id] ?? ''} onChange={setValue(block.id)} />
                </div>
              </BlockOuter>
            );
          }
          if (block.type === 'formSubmit') {
            return (
              <BlockOuter key={block.id} block={block} branding={form}>
                {state === 'error' && (
                  <p role="alert" className="text-body text-danger mb-2">
                    Something went wrong. Please try again.
                  </p>
                )}
                <RenderFormSubmitButton
                  block={block}
                  branding={form}
                  asSubmit
                  disabled={!canSubmit}
                  submitting={state === 'submitting'}
                />
              </BlockOuter>
            );
          }
          return <PublicBlockRenderer key={block.id} blocks={[block]} branding={form} doc={EMPTY_DOC} />;
        })}
    </form>
  );
}

/** A single live form field, keyed to the visitor's answer in the values map. */
function FormFieldControl({
  block,
  value,
  onChange,
}: {
  block: FormFieldBlock;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = block.label || 'Field';
  const placeholderProp = block.placeholder ? { placeholder: block.placeholder } : {};

  if (block.inputType === 'select') {
    // The shared Select cannot hold an empty-string option, so blank choices are
    // dropped and an unset field passes `undefined`, showing the placeholder.
    const options = (block.options ?? [])
      .filter((o) => o.trim() !== '')
      .map((o) => ({ value: o, label: o }));
    return (
      <Select
        label={label}
        required={block.required}
        options={options}
        placeholder={block.placeholder || 'Select an option'}
        {...(value ? { value } : {})}
        onValueChange={onChange}
      />
    );
  }

  if (block.inputType === 'textarea') {
    return (
      <Textarea
        label={label}
        required={block.required}
        value={value}
        {...placeholderProp}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      type={block.inputType}
      label={label}
      required={block.required}
      value={value}
      {...placeholderProp}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
