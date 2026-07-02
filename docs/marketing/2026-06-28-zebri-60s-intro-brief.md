# Zebri: 60-Second Cinematic Intro. Creative Brief, Script & Storyboard

## Context

Zebri is a production CRM for wedding MCs and celebrants in Australia. We need a
single 60-second cinematic intro that works in two places:

1. **The website hero** (autoplays, muted, with on-screen captions).
2. **A live conference** of working wedding MCs (plays full-screen, sound up).

The audience is the customer: working MCs and celebrants. The job of this film is
NOT to claim Zebri reduces admin (any CRM says that). It is to show the specific,
craft-deep features no generic tool would ever think of, and to make clear that each
one exists because a real MC asked for it. The product is the proof. The message is:
**built by MCs, for MCs.**

**Locked creative decisions:**

| Decision          | Choice                                                                  |
|-------------------|-------------------------------------------------------------------------|
| Deliverable       | Creative brief + script + storyboard (this doc). No code, no render.      |
| Audience          | Wedding MCs / celebrants at an industry conference (existing customers).   |
| Core concept      | **"Things only we thought of"**: a proud showcase of craft-specific features. |
| Spine / message   | Built by MCs, for MCs. Every feature exists because an MC asked for it.   |
| Visual treatment  | **Product UI as the hero**: the real features working on screen.          |
| Audio             | Warm voiceover + music. Captions baked in for the muted web cut.          |
| End card          | Zebri wordmark + "Built by MCs. For MCs." + URL.                         |

## The Big Idea

Anyone can build a CRM. It takes an MC to know what is actually missing from one.

The film is a confident, quietly proud montage of the things only a celebrant would
have thought to build: a place to *hear* a name, not just spell it; a list for the
songs that must never play; private rooms for each partner's vows; one link that
stops every vendor texting you on the day. We show each one working in the real
Zebri interface. We never raise our voice or oversell. The features speak for
themselves, and the throughline is unmistakable: this was made by people who have
stood at the mic.

## Why These Features (the shortlist)

Pulled from a full feature audit. These five are the strongest "no generic CRM has
this" beats, and each is clearly born from real MC experience:

1. **Name pronunciation audio.** Couples record their own and the wedding party's
   names; the MC presses play to hear it. Phonetic spelling too (Aoife, "Ee-fuh").
2. **The Do Not Play list.** A dedicated place for songs that must never play (the
   funeral song, the ex's song), alongside the song categories couples fill in.
3. **Private partner vows + revision history.** Each partner writes in a separate,
   token-gated portal so the other's vows stay a surprise. Every draft is saved and
   restorable; the MC can edit for pacing without losing the couple's voice.
4. **Shareable run-sheet link (no login).** Vendors and the couple open one always-
   current link to see the timeline, so nobody texts "when's the first dance?" all day.
5. **Ceremony questionnaires.** Questions written in wedding language, not SaaS
   language: ceremony tone, rituals (handfasting, sand, family blessings),
   acknowledgement of country, the formalities to run.

Held in reserve for a rapid-fire flourish if timing allows: internal-only timeline
notes (hidden from couple and vendors), reusable timeline/ceremony templates.

## Brand Guardrails

The film should feel like the product. Stay inside the existing design system:

- **Wordmark:** use the official asset from `.claude/brand_assets/`. Never recreate it.
- **Colours:** semantic tokens only. `bg-surface` / `bg-surface-muted` grounds,
  `text-text` / `text-text-muted` type, `brand` for the single accent. No off-token hex.
- **Type:** the product's type scale. Calm, generous spacing, no shouting.
- **UI on screen:** capture the real product (clean states, no clutter). Soft corners
  (`rounded-xl`), thin icons (`strokeWidth={1.5}`).
- **Feel:** minimal, modern, confident. The pride is quiet, not loud.
- **Copy:** no em dashes anywhere (on-screen or VO). Natural punctuation only.

## The 60-Second Arc

| Act            | Time        | Job                                                          |
|----------------|-------------|--------------------------------------------------------------|
| 1. The Claim   | 0:00 – 0:08 | Set up the insider stance: it takes an MC to know what's missing. |
| 2. The Showcase| 0:08 – 0:46 | Five craft-only features, each shown working in the real UI.  |
| 3. The Reason  | 0:46 – 0:54 | The turn: none of this came from a product team. It came from MCs. |
| 4. Wordmark    | 0:54 – 0:60 | Wordmark + "Built by MCs. For MCs." + URL.                   |

## Voiceover Script (warm, grounded, quietly proud)

> **(0:00, the claim)**
> "Anyone can build a CRM. It takes an MC to know what's actually missing from one."
>
> **(0:10, pronunciation)**
> "So we built a place for names. Not spelled. Spoken."
> *(beat. The audio clip plays on screen: "Aoife. Ee-fuh.")*
>
> **(0:18, do not play)**
> "A list for the songs that should never play. The funeral song. The ex's song."
>
> **(0:25, vows)**
> "Two private rooms for two sets of vows. Hers stay a surprise. His stay a surprise.
> Every draft, saved."
>
> **(0:33, run-sheet link)**
> "One link for every vendor. So nobody texts you 'when's the first dance' at four o'clock."
>
> **(0:40, questionnaire)**
> "And questions that actually sound like a wedding. The tone. The rituals. The
> acknowledgement of country."
>
> **(0:46, the reason)**
> "None of this came from a product meeting. It came from MCs who'd been caught out,
> and never wanted to be again."
>
> **(0:54, wordmark. Music resolves.)**
> "Zebri. Built by MCs. For MCs."

Word count ~95. Paced for ~60s. VO talent: warm, grounded, unhurried, Australian.
The tone is a confident insider letting you in on it, never a hard sell.

## Storyboard (shot by shot)

Product UI is the hero throughout. Each feature beat is a clean, designed shot of the
real Zebri interface doing the thing, with the MC VO line and a baked-in caption for
the muted web cut. Master ratio **16:9**.

### Act 1: The Claim (0:00–0:08)

- **S1 (0:00–0:08):** Clean `bg-surface`. A single calm line of type sets the stance
  while a faint, blurred Zebri interface rests behind it, out of focus. The line
  resolves: "It takes an MC to know what's missing." *Caption mirrors the VO.*

### Act 2: The Showcase (0:08–0:46)

Each beat: the relevant screen animates cleanly into focus, the key interaction plays,
then a soft transition to the next. Slow, confident motion. Single `brand` accent.

- **S2 Pronunciation (0:08–0:18):** A contact card for a wedding-party member. The
  phonetic spelling shows ("Aoife", "Ee-fuh"), then a play control is pressed and a
  small waveform animates as the name is heard. This is the hero beat. Let it breathe.
  *Caption: "A place for names. Not spelled. Spoken."*
- **S3 Do Not Play (0:18–0:25):** The song section. Categories fill in (First Dance,
  Entry), then the **Do Not Play** list is highlighted with two entries appearing.
  *Caption: "A list for the songs that should never play."*
- **S4 Vows (0:25–0:33):** Split composition: two partner portals side by side, each
  showing a private vow editor, a small lock/"private" indicator between them. A
  revision-history popover flicks open showing saved drafts. *Caption: "Two private
  rooms for two sets of vows. Every draft, saved."*
- **S5 Run-sheet link (0:33–0:40):** The timeline/run sheet. A "share link" toggles
  on; the view collapses to a clean read-only vendor link on a phone frame, updating
  live. *Caption: "One link for every vendor."*
- **S6 Questionnaire (0:40–0:46):** A ceremony questionnaire, one question at a time:
  tone options (relaxed and fun / warm and heartfelt), then a rituals question, then
  acknowledgement of country. *Caption: "Questions that actually sound like a wedding."*

### Act 3: The Reason (0:46–0:54)

- **S7 (0:46–0:54):** The UI gently recedes to a calm `bg-surface`. One line settles.
  *Caption: "None of this came from a product meeting. It came from MCs."*

### Act 4: Wordmark (0:54–0:60)

- **S8 (0:54–0:60):** Clean `bg-surface`. The official **Zebri wordmark** fades up,
  still. Beneath it: **"Built by MCs. For MCs."** and the URL (placeholder:
  `zebri.com`). Music resolves to a single warm chord and rests.

## Two Cuts From One Master

- **Conference cut:** VO + music up. Captions optional/off (the room hears it).
- **Web hero cut:** muted autoplay. VO removed; on-screen captions carry the message;
  music ducked or off. Same visuals and timing, so it's one edit with a caption layer
  and an audio toggle, not two productions.

## Music & Sound Design

- A warm, minimal, confident bed that builds gently across the showcase. Not tense,
  not triumphant. Assured.
- The pronunciation beat carries a real diegetic moment: the recorded name played
  aloud. Let the music duck under it.
- Soft, satisfying UI ticks as each feature locks into place.
- Wordmark: a single warm resolving chord, then rest.
- License a calm modern track (Musicbed / Artlist / Epidemic) or commission. Keep it
  understated. Confidence, not hype.

## Production Path

This is a hand-off-ready brief. To produce:

1. Capture the real product UI in clean states (a screen-capture tool with smooth
   zoom, or rebuild the key states from the design system for pixel accuracy).
2. Assemble and animate in After Effects (or Figma + a motion tool).
3. Record a warm Australian VO; for the pronunciation beat, record a genuine
   name-pronunciation clip. License/commission music; add light UI SFX.
4. Export the 16:9 master, then derive the muted captioned web cut and compress it
   for fast hero loading.
5. Optional later (out of scope here): 9:16 / 1:1 social cutdowns.

## Out of Scope

- No live-action footage.
- No social-format cutdowns in this pass.

## Definition of Done for the Brief

- Reads as a self-contained brief a motion designer + VO artist could execute without
  further questions.
- Hits exactly 60s with timed acts and a per-shot storyboard.
- Every feature beat maps to a real, shippable Zebri feature shown in the real UI.
- VO is final copy, warm and quietly proud, zero em dashes.
- Lands the "built by MCs, for MCs" message as the reason the features exist.
- Specifies both the conference cut and the muted web-hero cut from one master.
