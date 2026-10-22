import { SiApplepay } from 'react-icons/si';

import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { PlayIcon, SparklesIcon, CloseIcon } from '@/components/ui-v2/icons';
import { TextLink } from '@/components/ui-v2/text-link';

import { Demo, DemoRow, Group, Spec } from './showroom-v2';

/**
 * v2 buttons and links: every Button variant and the loading state, the
 * text link, and the copy button.
 *
 * @module app/design-system/v2/components-buttons
 */
export function ComponentsButtonsV2() {
  return (
    <Group id="buttons" title="Buttons & links">
      <Spec
        name="Button"
        file="components/ui-v2/button.tsx"
        description="One height, 36px, with the panel's 10px corners, so a button, a field and the dashboard's icon panel line up in any row. Primary for the one next step, secondary beside it, ghost and plain for quiet actions, ai (the grass-to-sky hairline with the Sparkles icon) for the one door into Zebri AI's advice, and glass (the Panel's material) for a control in the page bar beside the icon panel. While busy, the spinner sits over the label, so the button never changes size. Wallet is black, only for Apple Pay (Apple's guidelines), never a general action. Compact narrows the sides to 8px, only for a labelled button in a toolbar that must fit one line (the script editor's menus)."
      >
        <DemoRow>
          <Demo label="Primary">
            <Button>Send proposal</Button>
          </Demo>
          <Demo label="Secondary">
            <Button variant="secondary">Cancel</Button>
          </Demo>
          <Demo label="Delete">
            <Button variant="danger">Delete couple</Button>
          </Demo>
          <Demo label="Ghost">
            <Button variant="ghost">Skip setup</Button>
          </Demo>
          <Demo label="Plain">
            <Button variant="plain">Add another</Button>
          </Demo>
          <Demo label="Text">
            <Button variant="text">Add</Button>
          </Demo>
          <Demo label="Wallet">
            <Button variant="wallet" aria-label="Pay with Apple Pay">
              <SiApplepay aria-hidden="true" className="size-9" />
            </Button>
          </Demo>
          <Demo label="AI">
            <Button variant="ai">
              <SparklesIcon aria-hidden="true" className="size-3.5 text-grass-700" />
              AI insights
            </Button>
          </Demo>
          <Demo label="Glass">
            <Button variant="glass">FY 2026–27</Button>
          </Demo>
          <Demo label="Icon only">
            <Button variant="ghost" square aria-label="Close">
              <CloseIcon aria-hidden="true" className="size-4" />
            </Button>
          </Demo>
          <Demo label="Compact">
            <Button variant="ghost" compact>
              Noto Serif
            </Button>
          </Demo>
          <Demo label="Round">
            <Button variant="secondary" square round aria-label="Play">
              <PlayIcon aria-hidden="true" className="size-4" />
            </Button>
          </Demo>
          <Demo label="Loading">
            <Button loading>Saving</Button>
          </Demo>
        </DemoRow>
      </Spec>
      <Spec
        name="Text link"
        file="components/ui-v2/text-link.tsx"
        description="Underlined label weight; bolds on hover without shifting. Set inheritSize when it sits inside a sentence set in another role. With no href it is a button that looks the same, for an action inside a sentence that only changes what is shown (and 14 more)."
      >
        <DemoRow>
          <Demo label="On its own">
            <TextLink href="#buttons">View invoice</TextLink>
          </Demo>
          <Demo label="In a sentence">
            <p className="type-lead text-zebra-700">
              Booked by{' '}
              <TextLink inheritSize href="#buttons">
                Sophie &amp; James
              </TextLink>{' '}
              last night.
            </p>
          </Demo>
          <Demo label="As a button">
            <p className="type-body text-zebra-500">
              Still to come: Occupation and <TextLink inheritSize onClick={() => undefined}>14 more</TextLink>
            </p>
          </Demo>
        </DemoRow>
      </Spec>
      <Spec
        name="Copy button"
        file="components/ui-v2/copy-button.tsx"
        description="A button that copies a value and says so in place; it reserves the wider label so it never grows. Secondary by default; ghost in a header row beside a stronger action."
      >
        <div className="flex flex-wrap gap-3">
          <CopyButton value="https://zebri.com/arjun/intro" />
          <CopyButton value="https://zebri.com/p/amelia-jack" label="Portal link" variant="ghost" />
        </div>
      </Spec>
      <Spec
        name="Focus mark"
        file="app/globals.css"
        description="The one keyboard focus treatment for everything pressable (buttons, chips, cards, rows, swatches, tabs): a grass line 2px outside the shape, following its corners, keyboard only, never on a click. `focus-mark` on the control, `focus-mark-within` on a wrapper whose hidden input takes focus (a file drop). Text fields take no mark: their focus is the caret and the Field's name turning grass. Menu rows take none either: their highlight is the hover fill. Press Tab into the row below to see it."
      >
        <DemoRow>
          <Demo label="Button">
            <Button variant="secondary">Tab to me</Button>
          </Demo>
          <Demo label="Square button">
            <Button variant="ghost" square aria-label="Play">
              <PlayIcon aria-hidden="true" className="size-4" />
            </Button>
          </Demo>
          <Demo label="Link">
            <TextLink href="#buttons">A link</TextLink>
          </Demo>
          <Demo label="A card (always shown here)">
            <span className="block rounded-panel bg-field px-4 py-3 type-body text-zebra-950 shadow-btn-soft outline-2 outline-offset-2 outline-grass-500 outline-solid">
              What the mark looks like
            </span>
          </Demo>
        </DemoRow>
      </Spec>
    </Group>
  );
}
