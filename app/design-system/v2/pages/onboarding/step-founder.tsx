import Image from 'next/image';

/**
 * The last step, A note from the founder: a short personal letter and
 * the founder's name and photo, centred in the panel (the step is
 * `center` in steps-meta).
 *
 * @module app/design-system/v2/pages/onboarding/step-founder
 */

const PARAGRAPHS = [
  'Thank you for joining Zebri. I started this after my own wedding. Our MC was brilliant, and watching the day up close showed me how much rests on the person holding the microphone, and how little is built to support them.',
  'Zebri exists to give MCs and Celebrants the tools their craft deserves: one platform for the whole business, from first enquiry to wedding day, so your energy goes to the couples rather than the admin.',
  'This is just the start. The best parts of Zebri began as feedback from MCs and Celebrants like you, so if something is missing or in your way, tell me. I read every message.',
];

export function StepFounder() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-4">
        {PARAGRAPHS.map((p) => (
          <p key={p.slice(0, 20)} className="type-body leading-relaxed text-zebra-600">
            {p}
          </p>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-zebra-200 pt-6">
        <Image
          src="/headshot.jpeg"
          alt="Arjun Punekar, founder of Zebri"
          width={56}
          height={56}
          className="size-14 rounded-pill object-cover"
        />
        <span className="text-left">
          <span className="block type-label text-zebra-950">Arjun Punekar</span>
          <span className="block type-body text-zebra-500">Founder, Zebri</span>
        </span>
      </div>
    </div>
  );
}
