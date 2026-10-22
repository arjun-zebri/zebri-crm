import { CopyButton } from './copy-button';

/**
 * Design system v2 code block (preview): a snippet the MC pastes
 * somewhere else (a website embed, an API endpoint), in mono on the
 * soft grey desk fill, with a Copy button beside it. The code scrolls
 * sideways rather than wrapping, so a line pastes exactly as shown.
 * One block per snippet; it is the only grey fill in its section, so it
 * never sits inside another box.
 *
 * @example
 * ```tsx
 * <CodeBlock code={'<script src="https://zebri.app/embed.js" async></script>'} label="Copy code" />
 * <CodeBlock code="https://zebri.app/api/lead/submit" label="Copy URL" />
 * ```
 *
 * @module components/ui-v2/code-block
 */

export interface CodeBlockProps {
  code: string;
  /** The copy button's label. Defaults to "Copy code". */
  label?: string | undefined;
  /** Names the snippet for screen readers ("Embed code"). */
  'aria-label'?: string | undefined;
}

/** v2 code block. See {@link CodeBlockProps}. */
export function CodeBlock({ code, label = 'Copy code', ...aria }: CodeBlockProps) {
  return (
    <div className="flex items-start gap-2 rounded-panel bg-zebra-50 p-1.5 pl-4">
      <pre {...aria} className="min-w-0 flex-1 overflow-x-auto py-2 type-code text-zebra-800">
        <code>{code}</code>
      </pre>
      <CopyButton value={code} label={label} variant="ghost" />
    </div>
  );
}
