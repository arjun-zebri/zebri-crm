/**
 * Type-or-draw chooser for the signature, plus the preview of whichever the
 * signer picked.
 *
 * Type is the default. A typed name is what the existing flow does, is valid
 * under the ETA 1999, and works on any device; drawing is the option people
 * expect on a phone. Making drawing the default would regress signing for
 * anyone on a desktop with no trackpad they can sign on.
 *
 * The typed NAME is required in both modes and is collected separately by the
 * form above this: it identifies the signer, while the drawing is the mark.
 * That is also why the drawn preview still prints the typed name beneath it.
 *
 * @module app/contract/[token]/_components/contract-signature-tabs
 */
import { SignaturePad } from '@/components/ui/signature-pad';
import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { SIGNATURE_FONT_STACK } from '@/lib/branding/signature-font';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { SignatureMode } from '@/lib/contracts/signature-image';

export interface ContractSignatureTabsProps {
  mode: SignatureMode;
  onModeChange: (next: SignatureMode) => void;
  /** The drawn signature as a PNG data URL, or null. */
  drawnImage: string | null;
  onDrawnImageChange: (next: string | null) => void;
  /** The typed name, previewed in the script face under Type. */
  signerName: string;
  branding: PublicBranding;
  textColor: string;
  mutedColor: string;
  radius: number;
  /** Faint wash behind the preview, composited from the brand text colour. */
  previewBackground: string;
}

export function ContractSignatureTabs({
  mode,
  onModeChange,
  drawnImage,
  onDrawnImageChange,
  signerName,
  branding,
  textColor,
  mutedColor,
  radius,
  previewBackground,
}: ContractSignatureTabsProps) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint');
  const sectionHeadingDefaults = roleDefaults(branding, 'sectionHeading');

  const captionStyle = {
    color: mutedColor,
    fontSize: `${finePrintDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
  };

  // A segmented control, not underlined text tabs: the choice governs the rest
  // of the form, so it should read as a switch you set rather than navigation.
  const tab = (value: SignatureMode, label: string) => {
    const active = mode === value;
    return (
      <button
        key={value}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onModeChange(value)}
        className="cursor-pointer px-3 py-1 transition-colors"
        style={{
          backgroundColor: active ? contrastFill : 'transparent',
          color: active ? textColor : mutedColor,
          borderRadius: Math.max(Math.min(radius, 10) - 2, 2),
          fontSize: `${finePrintDefaults.fontSize}px`,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
        }}
      >
        {label}
      </button>
    );
  };

  // The selected segment's fill, composited from the document's own text
  // colour so the control belongs to the MC's brand rather than Zebri's.
  const rgb = getRgb(branding.text_color);
  const contrastFill = rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.08)` : 'transparent';

  const showTypedPreview = mode === 'typed' && signerName.trim().length > 0;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Signature style"
        className="mb-3 inline-flex items-center gap-1 border p-0.5"
        style={{ borderColor: branding.border_color, borderRadius: Math.min(radius, 10) }}
      >
        {tab('typed', 'Type')}
        {tab('drawn', 'Draw')}
      </div>

      {mode === 'drawn' ? (
        <div>
          <p className="mb-1.5" style={captionStyle}>
            Sign below with your finger or mouse
          </p>
          <SignaturePad
            value={drawnImage}
            onChange={onDrawnImageChange}
            label="Draw your signature"
            appearance={{
              strokeColor: textColor,
              borderColor: branding.border_color,
              backgroundColor: previewBackground,
              mutedColor,
              radius,
            }}
          />
        </div>
      ) : null}

      {showTypedPreview ? (
        <div
          className="border p-4"
          style={{
            borderRadius: radius,
            borderColor: branding.border_color,
            backgroundColor: previewBackground,
          }}
        >
          <p className="mb-1" style={captionStyle}>
            Your signature will appear as
          </p>
          <p
            style={{
              color: textColor,
              fontSize: `${sectionHeadingDefaults.fontSize}px`,
              fontFamily: SIGNATURE_FONT_STACK,
              lineHeight: sectionHeadingDefaults.lineHeight,
            }}
          >
            {signerName}
          </p>
        </div>
      ) : null}
    </div>
  );
}
