import type { ReactNode } from 'react';

/**
 * Layout scaffolding shared by every showroom section.
 *
 * These are presentation-only wrappers for the /design-system page. They
 * are deliberately not in `components/ui/` because nothing outside the
 * showroom should ever use them.
 *
 * @module app/design-system/showroom
 */

/** A top-level showroom section. `id` is the left-rail anchor target. */
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
 * One component entry: its name, source path, and rendered demos.
 *
 * `file` is shown verbatim so it can be pasted straight into an editor.
 */
export function Spec({
  name,
  file,
  description,
  children,
}: {
  name: string;
  file?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="space-y-3">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-body font-semibold text-text">{name}</h3>
        {file ? (
          <code className="rounded-control bg-surface-muted px-1.5 py-0.5 text-caption text-text-subtle">
            {file}
          </code>
        ) : null}
      </header>
      {description ? <p className="text-caption text-text-muted">{description}</p> : null}
      <div className="rounded-control border border-border bg-surface p-5">{children}</div>
    </article>
  );
}

/**
 * A labelled demo cell inside a {@link Spec}.
 *
 * The label sits above the specimen so a row of variants reads as a
 * comparison rather than a pile of controls.
 */
export function Demo({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-caption font-medium text-text-subtle">{label}</p>
      <div>{children}</div>
    </div>
  );
}

/** A responsive grid of {@link Demo} cells. */
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

/** A horizontal strip of specimens that should sit on one baseline. */
export function DemoRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/**
 * A dashed frame marking content that is a hand-built representative
 * sample rather than an importable component.
 *
 * Used by the page-patterns section, where the "component" only exists
 * as copy-pasted markup across many pages.
 */
export function SampleFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-dashed border-border-strong bg-surface-muted p-4">
      {children}
    </div>
  );
}
