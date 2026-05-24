/**
 * Notes textarea — appears below totals on both builders.
 *
 * Wrapped in a token-styled container so it visually matches the
 * meta-row controls. Used for payment instructions (invoices),
 * terms / conditions (quotes), or any free-text the MC wants on
 * the public document.
 *
 * @module components/builders/parts/notes-field
 */
'use client';

export interface NotesFieldProps {
  value: string;
  onChange: (next: string) => void;
  canEdit: boolean;
  /** Header shown above the textarea. */
  label?: string;
  placeholder?: string;
}

export function NotesField({
  value,
  onChange,
  canEdit,
  label = 'Notes',
  placeholder = 'Add any notes or terms…',
}: NotesFieldProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
        {label}
      </h4>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        readOnly={!canEdit}
        disabled={!canEdit}
        className="w-full rounded-card border border-border bg-surface px-3 py-2.5 text-body text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong disabled:opacity-70 resize-y"
      />
    </div>
  );
}
