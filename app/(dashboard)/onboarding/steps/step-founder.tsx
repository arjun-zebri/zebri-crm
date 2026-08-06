'use client'

import Image from 'next/image'

/**
 * Step 8: a personal note from the founder to close on.
 *
 * The one screen in the wizard that is allowed to be personal rather than
 * product. Real photo, real signature, and the why behind Zebri: the tour
 * ends on who built this and what they are building it towards, not on a
 * feature.
 */
export function StepFounder() {
  return (
    <div className="flex flex-col items-center text-center h-full justify-center gap-4 px-6">
      <Image
        src="/headshot.jpeg"
        alt="Arjun Punekar, founder of Zebri"
        width={144}
        height={144}
        className="w-28 h-28 sm:w-36 sm:h-36 rounded-pill object-cover border border-border shadow-sm"
      />

      <h2 className="text-xl font-semibold text-text">A note from the founder</h2>

      <div className="space-y-3 max-w-lg text-sm text-text-muted leading-relaxed">
        <p>
          Thank you so much for joining Zebri. I started this after my own
          wedding. Our MC was brilliant, and watching the day up close showed
          me how much rests on the person holding the microphone, and how
          little is built to support them.
        </p>
        <p>
          Zebri exists to give MCs and Celebrants the tools their craft
          deserves. One platform for the whole business, from first enquiry
          to wedding day, so your energy goes to the couples rather than the
          admin.
        </p>
        <p>
          And this is just the start. Zebri is shaped by its community. The
          best parts of it began as feedback from MCs and Celebrants like
          you, so if something is missing or in your way, please tell me. I
          read every message. Let&apos;s build something amazing together.
        </p>
      </div>

      <div className="flex flex-col items-center gap-0.5 pt-1">
        {/* The signature PNG carries a wide transparent canvas with the
            strokes in its left third; the fixed-width clip recentres the
            visible ink so it sits balanced over the name. */}
        <div className="h-10 w-20 overflow-hidden">
          <Image
            src="/signature.png"
            alt="Arjun's signature"
            width={159}
            height={40}
            className="h-10 w-auto max-w-none -ml-2"
          />
        </div>
        <span className="text-sm font-medium text-text">Arjun Punekar</span>
        <span className="text-xs text-text-subtle">Founder, Zebri</span>
      </div>
    </div>
  )
}
