import { Demo, DemoGrid, Rule, Spec } from './showroom';

/**
 * Shape foundations: type scale, corner radius, icon weight, padding.
 *
 * Every specimen renders with the class it names, so what you see is
 * the live value rather than a documented intention.
 *
 * @module app/design-system/foundations-shape
 */

const TYPE_SCALE = [
  { cls: 'text-display font-semibold', name: 'text-display', size: '30px', leading: '36px', use: 'Page titles' },
  { cls: 'text-section font-semibold', name: 'text-section', size: '20px', leading: '28px', use: 'Section titles' },
  {
    cls: 'text-body',
    name: 'text-body',
    size: '14px',
    leading: '20px',
    use: 'Everything else: body, labels, help text, captions, controls',
  },
];


/** The type scale and the two corner radii. */
export function FoundationsShape() {
  return (
    <>
      <Spec
        name="Typography"
        file="app/globals.css"
        description="Three sizes. Each token sets a font size and its line height together."
      >
        <Rule>
          There is one body size. Secondary text is distinguished by colour, not by shrinking it:
          use <code>text-text-muted</code> for supporting copy and <code>text-text-subtle</code>{' '}
          for meta and placeholders.
          <br />
          Each token sets <strong>both</strong> font size and line height, so you never pair one
          with a raw <code>leading-*</code>. Override the leading only when you genuinely need to,
          with <code>leading-tight</code> or <code>leading-relaxed</code>.
        </Rule>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem]">
            <thead>
              <tr className="text-left text-body text-text-subtle">
                <th className="pb-2 font-medium">Sample</th>
                <th className="pb-2 font-medium">Token</th>
                <th className="pb-2 font-medium">Font size</th>
                <th className="pb-2 font-medium">Line height</th>
                <th className="pb-2 font-medium">Use</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_SCALE.map((t) => (
                <tr key={t.name} className="border-t border-border align-baseline">
                  <td className="py-3 pr-6">
                    <span className={`${t.cls} whitespace-nowrap text-text`}>Wedding MC</span>
                  </td>
                  <td className="py-3 pr-6">
                    <code className="text-body text-text">{t.name}</code>
                  </td>
                  <td className="py-3 pr-6 text-body tabular-nums text-text-muted">{t.size}</td>
                  <td className="py-3 pr-6 text-body tabular-nums text-text-muted">{t.leading}</td>
                  <td className="py-3 text-body text-text-muted">{t.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Spec>

      <Spec name="Radius" file="app/globals.css" description="Two tokens, deliberately.">
        <DemoGrid cols={2}>
          <Demo label="rounded-control · 6px · everything with corners">
            <div className="h-14 rounded-control border border-border bg-surface-muted" />
          </Demo>
          <Demo label="rounded-pill · 9999px · pills, chips, avatars, dots">
            <div className="h-14 rounded-pill border border-border bg-surface-muted" />
          </Demo>
        </DemoGrid>
      </Spec>

    </>
  );
}
