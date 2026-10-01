import type { ReactNode } from 'react';

/**
 * Layout scaffolding for the v2 design system page, set in v2 type and
 * colour so the frame around each component matches the component. (The
 * v1 `../showroom` wrappers set everything in v1 tokens, which put two
 * type systems on one page.)
 *
 * The heading ladder: page title `type-display`, section `type-title`,
 * group `type-heading`, component `type-subheading` with its file in
 * `type-code`. Presentation only; nothing outside the page uses these.
 *
 * @module app/design-system/v2/showroom-v2
 */

/** A top-level section (Foundations, Components, Pages). `id` is the rail anchor. */
export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-10">
      <header className="space-y-1">
        <h2 className="type-title text-zebra-950">{title}</h2>
        {description ? <p className="max-w-2xl type-body text-zebra-500">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A group of related components inside a section (Buttons & links, Inputs). */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-8 space-y-8">
      <h3 className="type-heading text-zebra-950">{title}</h3>
      {children}
    </div>
  );
}

/** One component entry: its name, its file, a line on when to use it, and live examples. */
export function Spec({ name, file, description, children }: { name: string; file: string; description?: ReactNode; children: ReactNode }) {
  return (
    <article className="space-y-3">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="type-subheading text-zebra-950">{name}</h4>
          <code className="type-code text-zebra-400">{file}</code>
        </div>
        {description ? <p className="max-w-3xl type-body text-zebra-500">{description}</p> : null}
      </header>
      <div className="space-y-6 rounded-panel border border-zebra-200 bg-field p-5 sm:p-6">{children}</div>
    </article>
  );
}

/** A labelled demo cell: what the variant is, then the variant. */
export function Demo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-2${className ? ` ${className}` : ''}`}>
      <p className="type-body text-zebra-500">{label}</p>
      {children}
    </div>
  );
}

/** A wrapping row of demo cells, their labels on one line. */
export function DemoRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-x-8 gap-y-6">{children}</div>;
}
