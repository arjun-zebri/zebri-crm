'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EditIcon } from '@/components/ui-v2/icons';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { useAccount } from '../../account';
import { BRAND } from '../../proposals/templates-data';
import { SIGNATURES, TEMPLATES } from '../email-data';
import { SignatureBlock } from '../render/email-body';

/**
 * The MC's signatures, opened from Signatures in the Templates toolbar:
 * an `lg` dialog listing each one as couples see it sign off an email
 * (`SignatureBlock`, in the brand), with its name and the templates that
 * use it. Full is the default for new templates. Each template picks its
 * own in the template dialog, so a planning email can carry the booking
 * link and a quick reply can sign off with a first name. New signature
 * (secondary) opens the builder stub.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/signatures-dialog
 */

export interface SignaturesDialogProps {
  open: boolean;
  onNew: () => void;
  onClose: () => void;
}

/** The live templates signing off with a signature. */
const usersOf = (id: string) => TEMPLATES.filter((t) => t.signature === id && !t.archivedOn);

/** The signatures dialog. See {@link SignaturesDialogProps}. */
export function SignaturesDialog({ open, onNew, onClose }: SignaturesDialogProps) {
  const { brand } = useAccount();
  return (
    <Dialog open={open} onClose={onClose} size="lg" aria-labelledby="signatures-title">
      <DialogHeader
        id="signatures-title"
        icon={EditIcon}
        title="Signatures"
        actions={
          <Button variant="secondary" onClick={onNew}>
            New signature
          </Button>
        }
      />
      <div className="shrink-0 px-6 pt-2 pb-4 sm:px-10">
        <p className="type-lead text-zebra-500">Each template picks the one it signs off with.</p>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 pb-6 sm:px-10 sm:pb-10">
        {SIGNATURES.map((s) => {
          const users = usersOf(s.id);
          return (
            <li key={s.id} className="grid gap-4 py-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <div className="space-y-1">
                <p className="flex items-center gap-2 type-label text-zebra-950">
                  {s.name}
                  {s.id === 'full' ? <Badge tone="brand">Default</Badge> : null}
                </p>
                <p className="type-body text-zebra-500">
                  {users.length === 0
                    ? 'No templates use it'
                    : `${users.length} template${users.length === 1 ? '' : 's'}: ${users.map((t) => t.name).join(', ')}`}
                </p>
              </div>
              <div style={brandVars(brand ?? BRAND)} className="rounded-button bg-zebra-50 px-5 pb-4 pt-2">
                <SignatureBlock signature={s.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
