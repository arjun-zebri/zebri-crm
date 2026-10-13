/**
 * One editable contact (email, Instagram, website or phone). Saves on
 * blur, only when the value actually changed. Shows where the value came
 * from, and for email whether the address will take mail.
 *
 * @module features/outreach/views/prospects/contact-field
 */
import { Input } from '@/components/ui/input';
import { updateProspectAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

import { FoundEmailSuggestion } from './found-email-suggestion';
import { BAD_EMAIL_CHECKS, EMAIL_CHECK_LABELS } from './labels';
import { useDraft } from './use-draft';

/** Which contact this field edits. Each maps to one column on the prospect. */
export type ContactKind = 'email' | 'instagram' | 'website' | 'phone';

const COLUMN: Record<ContactKind, string> = {
  email: 'email',
  instagram: 'instagram_handle',
  website: 'website',
  phone: 'phone',
};

const INPUT: Record<ContactKind, { label: string; type: string; placeholder: string }> = {
  email: { label: 'Email', type: 'email', placeholder: 'name@example.com' },
  instagram: { label: 'Instagram', type: 'text', placeholder: '@handle' },
  website: { label: 'Website', type: 'url', placeholder: 'https://' },
  phone: { label: 'Phone', type: 'tel', placeholder: '04xx xxx xxx' },
};

/** Where a stored value came from, in words. */
function sourceLabel(source: string | null): string {
  if (source === 'found') return 'Found online';
  if (source === 'manual') return 'Added by you';
  return 'From sheet';
}

/** Props for {@link ContactField}. */
export interface ContactFieldProps {
  kind: ContactKind;
  prospectId: string;
  value: string | null;
  source: string | null;
  /** Email check result. Only meaningful for `kind="email"`. */
  emailCheck?: string;
}

/** An editable contact with its source and, for email, its delivery check. */
export function ContactField({ kind, prospectId, value, source, emailCheck }: ContactFieldProps) {
  const serverValue = value ?? '';
  const [draft, setDraft] = useDraft(serverValue);
  const save = useOutreachMutation(updateProspectAction, 'Saved');
  const meta = INPUT[kind];

  function commit() {
    const next = draft.trim();
    if (next === serverValue) return;
    save.mutate({ id: prospectId, patch: { [COLUMN[kind]]: next === '' ? null : next } });
  }

  const bad = kind === 'email' && emailCheck !== undefined && (BAD_EMAIL_CHECKS as readonly string[]).includes(emailCheck);
  // Why one line of help text rather than pills: four fields each with a
  // row of pills under them read as a wall. Source and check fit in a line.
  // Why: a scraped email is a suggestion until confirmed, so its suggestion callout says the source; the help line would repeat it.
  const suggested = kind === 'email' && source === 'found' && !!value;
  const help = value && !suggested
    ? [sourceLabel(source), kind === 'email' && emailCheck === 'ok' ? EMAIL_CHECK_LABELS.ok : null].filter(Boolean).join(' · ')
    : undefined;
  const error = bad && emailCheck ? (EMAIL_CHECK_LABELS[emailCheck] ?? emailCheck) : undefined;
  return (
    <div className="space-y-2">
      <Input
        label={meta.label}
        type={meta.type}
        placeholder={meta.placeholder}
        value={draft}
        disabled={save.isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        help={help}
        error={error}
      />
      {suggested && <FoundEmailSuggestion prospectId={prospectId} />}
    </div>
  );
}
