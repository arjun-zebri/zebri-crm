/**
 * Shown when `get_lead_form` returns null (bad token or the MC disabled the
 * form). Deliberately vague: never confirm whether a token exists.
 *
 * @module app/lead/[token]/_components/lead-form-unavailable
 */
export function LeadFormUnavailable() {
  return (
    <div className="text-center py-10">
      <h2 className="text-xl font-semibold text-text">Form unavailable</h2>
      <p className="text-sm text-text-muted mt-2">
        This enquiry form is not currently available.
      </p>
    </div>
  );
}
