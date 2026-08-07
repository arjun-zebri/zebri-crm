import type { ReactNode } from 'react';

/**
 * Layout scaffolding for the design system reference.
 *
 * These are presentation-only wrappers for the /design-system page.
 * They live here rather than in `components/ui/` because nothing outside
 * the reference should use them.
 *
 * @module app/design-system/showroom
 */

/** A top-level section. `id` is the left-rail anchor target. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border pt-10">
      <h2 className="text-section font-semibold text-text">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-body text-text-muted">{description}</p>
      ) : null}
      <div className="mt-6 space-y-10">{children}</div>
    </section>
  );
}

/**
 * One component entry: its name, where it lives, how to import it, and
 * its examples.
 */
export function Spec({
  name,
  file,
  importPath,
  description,
  children,
}: {
  name: string;
  file?: string;
  /** Module to import from. Rendered as a copyable import line. */
  importPath?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="space-y-3">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-body font-semibold text-text">{name}</h3>
        {file ? (
          <code className="rounded-control bg-surface-muted px-1.5 py-0.5 text-body text-text-subtle">
            {file}
          </code>
        ) : null}
      </header>
      {description ? <p className="text-body text-text-muted">{description}</p> : null}
      {importPath ? <CodeBlock code={`import { ${name.split(' ')[0]} } from '${importPath}'`} /> : null}
      <div className="space-y-6 rounded-control border border-border bg-surface p-5">{children}</div>
    </article>
  );
}

/** A fenced, monospaced code sample. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-control border border-border bg-surface-muted px-3 py-2 text-body leading-relaxed text-text-muted">
      <code>{code}</code>
    </pre>
  );
}

/**
 * A labelled example: the live component above, the JSX that produced
 * it below. The code is the point of the page, so it is always visible
 * rather than hidden behind a toggle.
 */
export function Example({
  label,
  code,
  children,
}: {
  label?: ReactNode;
  /** The JSX that renders `children`. Keep it copy-pasteable. */
  code?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {label ? <p className="text-body font-medium text-text-subtle">{label}</p> : null}
      <div>{children}</div>
      {code ? <CodeBlock code={code} /> : null}
    </div>
  );
}

/** A labelled demo cell with no code block, for dense variant matrices. */
export function Demo({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-body font-medium text-text-subtle">{label}</p>
      <div>{children}</div>
    </div>
  );
}

/** A responsive grid of cells. */
export function DemoGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  // Explicit class strings, not interpolation: Tailwind only emits
  // classes it can see as complete literals at build time.
  const colClass =
    cols === 2
      ? 'sm:grid-cols-2'
      : cols === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid grid-cols-1 gap-6 ${colClass}`}>{children}</div>;
}

/** A horizontal strip of specimens sharing one baseline. */
export function DemoRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/**
 * A dashed frame marking a composed pattern rather than an importable
 * component, so it is obvious which examples you can `import` and which
 * you assemble yourself.
 */
export function SampleFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-dashed border-border-strong bg-surface-muted p-4">
      {children}
    </div>
  );
}

/** A rule stated once, in the component's own entry. */
export function Rule({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-border-strong pl-3 text-body text-text-muted">{children}</p>
  );
}
