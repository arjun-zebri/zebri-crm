'use client';

import { SearchIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { FormCard } from './form-parts';
import { AREAS, EXEMPT } from './forms-data';

/**
 * Every form in the v2 app, drawn in the proposed two styles (user,
 * 2026-10-15: "a complete list of all our inputs/forms and show me what
 * each of them will look like"). Fields: name above a hairline box.
 * Properties: chips. Then the inputs that are not forms and keep their
 * own look. Mocks only.
 *
 * @module app/design-system/v2/light-box/all/page
 */
export default function AllFormsPage() {
  const count = AREAS.reduce((n, a) => n + a.forms.length, 0);
  return (
    <main className="min-h-screen bg-zebra-50 px-4 py-10 md:px-10">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="max-w-3xl space-y-3">
          <h1 className="type-title text-zebra-950">Every form, in two styles</h1>
          <p className="type-body text-zebra-600">
            All {count} forms in the app today, with the demo account&rsquo;s data where it has
            some. Two styles only: anything you type is a{' '}
            <strong className="font-medium text-zebra-950">field</strong> (its name above a hairline
            box, no icon inside); an optional detail you pick is a{' '}
            <strong className="font-medium text-zebra-950">property</strong> (a chip, the same one a
            client&rsquo;s Overview row opens). Everything is one size.
          </p>
        </header>
        {AREAS.map((a) => (
          <section key={a.area} className="space-y-4">
            <h2 className="type-heading text-zebra-950">{a.area}</h2>
            <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
              {a.forms.map((f) => (
                <FormCard key={`${f.file}-${f.title}`} form={f} />
              ))}
            </div>
          </section>
        ))}
        <section className="space-y-4 border-t border-hairline pt-10">
          <h2 className="type-heading text-zebra-950">Not forms: these keep their own look</h2>
          <div className="max-w-xs">
            <Input
              type="search"
              raised
              aria-label="Search clients"
              placeholder="Search clients"
              leading={<SearchIcon aria-hidden="true" className="size-4" />}
            />
          </div>
          <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {EXEMPT.map((e) => (
              <div key={e.what} className="space-y-0.5">
                <dt className="type-label text-zebra-950">{e.what}</dt>
                <dd className="type-body text-zebra-600">
                  {e.why} <span className="text-zebra-400">({e.where})</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
