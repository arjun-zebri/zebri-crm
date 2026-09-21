// tests/unit/features/proposals/editor/node-views.test.tsx
/**
 * Task 7: the rich doc's atom/container node views
 * (`features/proposals/editor/node-views/`), mounted through
 * `ContentSectionEditor` (which always builds its extensions with
 * `nodeViews: true`). Clicking a node view selects it in the TipTap
 * document and reports it through `onNodeSelect`, without hijacking a
 * click meant to place a caret inside a column or bubbling to an
 * ancestor; the image's side and corner grips resize `widthPct`,
 * snapping near a round value; the spacer's grip steps/drags `heightPx`
 * within 8..160; the columns gutter writes complementary `ratio`s to its
 * two neighbouring columns, snapping at the 1/2 and 1/3 splits; a live
 * branding change reaches an already-mounted button view.
 *
 * The renderer split this task made (`render/rich-doc-nodes.tsx`) is
 * covered by its own parity test, `render/rich-doc.test.tsx`, which stays
 * green unchanged: the public page's output did not move.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { button, column, columns, CONTENT_PLACEHOLDER, ContentSectionEditor, doc, getEditor, image, paragraph, spacer, text, variable, defaultTheme } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const SAMPLE_BRANDING = buildPublicBranding({ business_name: 'Sam MC' })
const SAMPLE_THEME = defaultTheme(SAMPLE_BRANDING)

/** Wait for `sectionId`'s editor to be registered and return it (mirrors `content-section-editor.test.tsx`). */
async function waitForEditor(sectionId: string) {
  await waitFor(() => expect(getEditor(sectionId)).not.toBeNull())
  return getEditor(sectionId)!
}

/** The `heightPx`/`widthPct`/`ratio` attrs a test cares about live on ProseMirror nodes, not React state; read them back by walking the live document. */
function attrsOf(doc_: ProseMirrorNode, type: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  doc_.descendants((n) => {
    if (n.type.name === type) found.push(n.attrs)
  })
  return found
}

/**
 * Stubs every element's `clientWidth` to `px`: jsdom does no layout, so
 * `image-view.tsx`'s measuring overlay (a plain `clientWidth` read, not
 * an `offsetParent` one - see finding 11 of the review) would otherwise
 * report 0 and fall back to the 720px default.
 */
function stubColumnWidth(px: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(px)
}

describe('rich doc node views', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('selects the image node on click and reports it through onNodeSelect', async () => {
    const onNodeSelect = vi.fn()
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv1"
        content={doc(paragraph(text('Note')), image({ src: 'https://x/a.jpg', alt: 'A', layout: 'inline', widthPct: 40 }))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    const editor = await waitForEditor('nv1')
    const wrapper = container.querySelector('[data-node-type="image"]')
    expect(wrapper).not.toBeNull()

    fireEvent.click(wrapper!)

    const selection = editor.state.selection
    expect(selection).toBeInstanceOf(NodeSelection)
    expect((selection as NodeSelection).node.type.name).toBe('image')
    expect(onNodeSelect).toHaveBeenLastCalledWith({ sectionId: 'nv1', nodeType: 'image', pos: (selection as NodeSelection).from })
  })

  it('a click on a node view does not bubble to an ancestor click handler', async () => {
    const onAncestorClick = vi.fn()
    const { container } = render(
      <div onClick={onAncestorClick}>
        <ContentSectionEditor
          sectionId="nv8"
          content={doc(paragraph(text('Note')), spacer(24))}
          branding={SAMPLE_BRANDING}
          theme={SAMPLE_THEME}
          externalVersion={0}
          onChange={() => {}}
          onFocusSection={() => {}}
          onNodeSelect={() => {}}
        />
      </div>,
    )
    await waitForEditor('nv8')
    fireEvent.click(container.querySelector('[data-node-type="spacer"]')!)
    expect(onAncestorClick).not.toHaveBeenCalled()
  })

  it('a click on the gutter gap or a column\'s own empty area still selects the columns row', async () => {
    const onNodeSelect = vi.fn()
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv13"
        content={doc(columns(column(0.5, paragraph(text('Left'))), column(0.5, paragraph(text('Right')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    const editor = await waitForEditor('nv13')

    // The gutter gap: a click whose target is the content wrapper itself
    // (`[data-node-view-content]`, `NodeViewContent`'s own element), not
    // any descendant of it.
    const content = container.querySelector('[data-node-view-content]')
    expect(content).not.toBeNull()
    fireEvent.click(content!)
    let selection = editor.state.selection
    expect(selection).toBeInstanceOf(NodeSelection)
    expect((selection as NodeSelection).node.type.name).toBe('columns')
    expect(onNodeSelect).toHaveBeenLastCalledWith({ sectionId: 'nv13', nodeType: 'columns', pos: (selection as NodeSelection).from })

    onNodeSelect.mockClear()
    act(() => {
      editor.commands.setTextSelection(1)
    })

    // A column's own empty area: a click whose target is the column's
    // box (`[data-node="column"]`) itself, not the paragraph text inside it.
    const columnBox = container.querySelector('[data-node="column"]')
    expect(columnBox).not.toBeNull()
    fireEvent.click(columnBox!)
    selection = editor.state.selection
    expect(selection).toBeInstanceOf(NodeSelection)
    expect((selection as NodeSelection).node.type.name).toBe('columns')
    expect(onNodeSelect).toHaveBeenLastCalledWith({ sectionId: 'nv13', nodeType: 'columns', pos: (selection as NodeSelection).from })
  })

  it('a click inside column text places a caret instead of selecting the whole row', async () => {
    const onNodeSelect = vi.fn()
    render(
      <ContentSectionEditor
        sectionId="nv5"
        content={doc(columns(column(0.5, paragraph(text('Left'))), column(0.5, paragraph(text('Right')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    const editor = await waitForEditor('nv5')
    fireEvent.click(screen.getByText('Left'))
    expect(editor.state.selection).toBeInstanceOf(TextSelection)
    expect(onNodeSelect).not.toHaveBeenCalledWith(expect.objectContaining({ nodeType: 'columns' }))
  })

  it('renders the figure as a direct child of the wrapper, with the ring/grip overlay only while selected', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv14"
        content={doc(paragraph(text('Note')), image({ src: 'https://x/a.jpg', alt: 'A', layout: 'inline', widthPct: 40 }))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv14')
    const wrapper = container.querySelector('[data-node-type="image"]')!
    const figure = wrapper.querySelector('figure')
    expect(figure).not.toBeNull()
    // No box between the wrapper and the figure: dropping the old
    // `inline-block w-fit` shrink-wrap (see the module doc) means a
    // floated figure now escapes the wrapper exactly as it does on the
    // public page. Real browser geometry (does the ring actually land on
    // the figure's rendered box) is verified in Task 16, not here: jsdom
    // does no layout, so `offsetLeft/Top/Width/Height` all read 0.
    expect(figure!.parentElement).toBe(wrapper)
    expect(wrapper.querySelector('.ring-brand-fg')).toBeNull()

    let imagePos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'image') imagePos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(imagePos)
    })

    expect(wrapper.querySelector('.ring-brand-fg')).not.toBeNull()
    // Four corner dots, no edge bars.
    expect(screen.getAllByRole('slider', { name: /^Image size, / })).toHaveLength(4)
    expect(screen.queryByRole('slider', { name: /edge$/ })).toBeNull()
    // The overlay still is not itself a wrapper around the figure: it is
    // an absolutely positioned sibling, so it does not appear between the
    // wrapper and the figure in the tree.
    expect(figure!.parentElement).toBe(wrapper)
  })

  it("drags the image's bottom-right corner grip to resize widthPct, snapping near 50", async () => {
    // The grip's scale comes from a dedicated full-column measuring
    // overlay (`image-view.tsx`'s `columnRef`); jsdom does no layout
    // (clientWidth is 0 without a stub), so this stubs a 300px column to
    // match the brief's worked example exactly.
    stubColumnWidth(300)

    render(
      <ContentSectionEditor
        sectionId="nv2"
        content={doc(paragraph(text('Note')), image({ src: 'https://x/a.jpg', alt: 'A', layout: 'inline', widthPct: 40 }))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv2')
    let imagePos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'image') imagePos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(imagePos)
    })

    const grip = screen.getByRole('slider', { name: 'Image size, bottom-right corner' })
    // scale = 300 / 100 = 3px per percentage point; a 30px drag is +10.
    fireEvent.mouseDown(grip, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 130 })
    fireEvent.mouseUp(window)
    expect(attrsOf(editor.state.doc, 'image')[0]?.widthPct).toBe(50)

    // A further +2 lands inside the tolerance-3 snap around 50 and locks onto it exactly.
    fireEvent.mouseDown(grip, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 106 })
    fireEvent.mouseUp(window)
    expect(attrsOf(editor.state.doc, 'image')[0]?.widthPct).toBe(50)
  })

  it("drags an image corner grip (inverted, since it's on the image's left side) to resize widthPct", async () => {
    stubColumnWidth(300)
    render(
      <ContentSectionEditor
        sectionId="nv10"
        content={doc(paragraph(text('Note')), image({ src: 'https://x/a.jpg', alt: 'A', layout: 'inline', widthPct: 40 }))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv10')
    let imagePos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'image') imagePos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(imagePos)
    })

    const grip = screen.getByRole('slider', { name: 'Image size, top-left corner' })
    // Dragging left (toward the image, away from the column) grows the
    // width when inverted: -30px at scale 3 is +10.
    fireEvent.mouseDown(grip, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 70 })
    fireEvent.mouseUp(window)
    expect(attrsOf(editor.state.doc, 'image')[0]?.widthPct).toBe(50)
  })

  it('steps the spacer height by 8 with the resize grip', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv3"
        content={doc(paragraph(text('Note')), spacer(24))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv3')
    let spacerPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'spacer') spacerPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(spacerPos)
    })

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Spacer height' }), { key: 'ArrowDown' })
    expect(attrsOf(editor.state.doc, 'spacer')[0]?.heightPx).toBe(32)
  })

  it('drags the spacer grip with the mouse, clamped to 8..160', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv7"
        content={doc(paragraph(text('Note')), spacer(24))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv7')
    let spacerPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'spacer') spacerPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(spacerPos)
    })

    const grip = screen.getByRole('slider', { name: 'Spacer height' })
    fireEvent.mouseDown(grip, { clientY: 0 })
    fireEvent.mouseMove(window, { clientY: 500 }) // far past the 160px max
    fireEvent.mouseUp(window)
    expect(attrsOf(editor.state.doc, 'spacer')[0]?.heightPx).toBe(160)

    fireEvent.mouseDown(grip, { clientY: 0 })
    fireEvent.mouseMove(window, { clientY: -500 }) // far past the 8px min
    fireEvent.mouseUp(window)
    expect(attrsOf(editor.state.doc, 'spacer')[0]?.heightPx).toBe(8)
  })

  it('writes complementary ratios from the columns gutter grip', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv4"
        content={doc(columns(column(0.5, paragraph(text('L'))), column(0.5, paragraph(text('R')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv4')
    let columnsPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'columns') columnsPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(columnsPos)
    })

    // 720px fallback row width (unstubbed here) -> scale 7.2px per point;
    // a 72px drag is +10 points, from an even 50/50 split to 60/40.
    fireEvent.mouseDown(screen.getByRole('slider', { name: 'Column split 1' }), { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 72 })
    fireEvent.mouseUp(window)

    const ratios = attrsOf(editor.state.doc, 'column').map((a) => a.ratio)
    expect(ratios[0]).toBeCloseTo(0.6)
    expect(ratios[1]).toBeCloseTo(0.4)
  })

  it('the columns gutter grip snaps to the 1/2 split', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv11"
        content={doc(columns(column(0.47, paragraph(text('L'))), column(0.53, paragraph(text('R')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv11')
    let columnsPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'columns') columnsPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(columnsPos)
    })

    // 47 + 1 (keyboard step) = 48 raw, within the tolerance-3 snap around the 1/2 split (50).
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Column split 1' }), { key: 'ArrowRight' })
    const ratios = attrsOf(editor.state.doc, 'column').map((a) => a.ratio)
    expect(ratios[0]).toBeCloseTo(0.5)
    expect(ratios[1]).toBeCloseTo(0.5)
  })

  it('the columns gutter grip snaps to the 1/3 split', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv12"
        content={doc(columns(column(0.35, paragraph(text('L'))), column(0.65, paragraph(text('R')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv12')
    let columnsPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'columns') columnsPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(columnsPos)
    })

    // 35 - 1 (keyboard step) = 34 raw, within the tolerance-3 snap around the 1/3 split (33.33).
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Column split 1' }), { key: 'ArrowLeft' })
    const ratios = attrsOf(editor.state.doc, 'column').map((a) => a.ratio)
    expect(ratios[0]).toBeCloseTo(1 / 3, 2)
    expect(ratios[1]).toBeCloseTo(2 / 3, 2)
  })

  /** The visible hint (`data-placeholder`, `''` folded to `null`: the CSS renders `attr()` of an empty value as nothing) on each element `selector` matches, in document order. */
  function hintsOf(container: HTMLElement, selector: string): (string | null)[] {
    return Array.from(container.querySelectorAll(selector)).map((el) => el.getAttribute('data-placeholder') || null)
  }
  /** {@link hintsOf} for every `column` cell's first block. */
  const columnPlaceholders = (container: HTMLElement) => hintsOf(container, '[data-node="column"] > :first-child')

  it('shows the "Type / to add content" hint in every empty column, caret or not (no "Empty columns" overlay)', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv15"
        content={doc(paragraph(text('Intro')), columns(column(0.5, paragraph()), column(0.5, paragraph())))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv15')
    expect(screen.queryByText('Empty columns')).toBeNull()
    // The caret sits at the doc start (inside "Intro"), nowhere near the
    // row: each cell still carries its own hint.
    expect(columnPlaceholders(container)).toEqual([CONTENT_PLACEHOLDER, CONTENT_PLACEHOLDER])
  })

  it('drops the hint from a column once it has content, and keeps it on the still-empty one', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv16"
        content={doc(columns(column(0.5, paragraph(text('Left'))), column(0.5, paragraph())))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv16')
    expect(columnPlaceholders(container)).toEqual([null, CONTENT_PLACEHOLDER])
  })

  it('keeps the hint on empty columns while the row is selected', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv17"
        content={doc(columns(column(0.5, paragraph()), column(0.5, paragraph())))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv17')
    let columnsPos = -1
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'columns') columnsPos = pos
    })
    act(() => {
      editor.commands.setNodeSelection(columnsPos)
    })
    expect(columnPlaceholders(container)).toEqual([CONTENT_PLACEHOLDER, CONTENT_PLACEHOLDER])
  })

  it('lays the column cells out inside the flex row TipTap\'s contentDOM child carries (the cells were stacking under a `flex` wrapper)', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv19"
        content={doc(columns(column(0.5, paragraph(text('Left'))), column(0.5, paragraph(text('Right')))))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv19')
    const wrapper = container.querySelector('[data-columns]')!
    // TipTap 3 appends its own contentDOM element inside `NodeViewContent`
    // and the `column` cells land in there, one level below the wrapper.
    const contentDom = wrapper.querySelector(':scope > [data-node-view-content-react]')!
    expect(contentDom).not.toBeNull()
    expect(contentDom.querySelectorAll(':scope > [data-node="column"]')).toHaveLength(2)
    // So the row classes have to reach that child, not sit on the wrapper.
    expect(wrapper.className).toContain('*:flex')
    expect(wrapper.className).toContain('@max-3xl/doc:*:flex-col')
    expect(wrapper.className).not.toMatch(/(^|\s)flex(\s|$)/)
  })

  it('still shows the hint only on the caret\'s line at the top level (an empty line elsewhere stays blank)', async () => {
    const { container } = render(
      <ContentSectionEditor
        sectionId="nv18"
        content={doc(paragraph(), paragraph(text('Body')), paragraph())}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    const editor = await waitForEditor('nv18')
    act(() => {
      editor.commands.setTextSelection(1)
    })
    expect(hintsOf(container, '.ProseMirror > p')).toEqual([CONTENT_PLACEHOLDER, null, null])
  })

  it('a mounted button view re-renders with a live branding change through context', async () => {
    const content = doc(paragraph(text('Note')), button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left' }))
    const { rerender, container } = render(
      <ContentSectionEditor
        sectionId="nv9"
        content={content}
        branding={buildPublicBranding({ business_name: 'Sam MC', brand_color: '#111827' })}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv9')

    rerender(
      <ContentSectionEditor
        sectionId="nv9"
        content={content}
        branding={buildPublicBranding({ business_name: 'Sam MC', brand_color: '#0b5fff' })}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )

    const control = container.querySelector('[data-node-type="button"] button, [data-node-type="button"] a')
    expect(control).not.toBeNull()
    // jsdom normalises the hex colour in the `style` attribute to rgb(...): #0b5fff -> rgb(11, 95, 255).
    expect(control!.getAttribute('style')).toContain('background: rgb(11, 95, 255)')
  })

  // UX audit §3.1: with no node view a `variable` renders as an empty span
  // (the server-safe `renderHTML` in `lib/branding/rich-text-extensions.ts`)
  // - invisible until the id is resolved on send. `VariableView` labels it.
  it('renders a variable node as a labelled chip, not an empty span', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv10"
        content={doc(paragraph(text('Hi '), variable('couple_name')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv10')
    const chip = screen.getByText('Couple name')
    expect(chip).toBeInTheDocument()
    // The house variable chip (the email composer's mention token): mint
    // on the control radius, never a grey pill.
    expect(chip.className).toContain('bg-emerald-50')
    expect(chip.className).toContain('rounded-control')
    expect(chip.className).not.toContain('rounded-pill')
  })

  it('selects a variable node on click and reports it through onNodeSelect', async () => {
    const onNodeSelect = vi.fn()
    render(
      <ContentSectionEditor
        sectionId="nv11"
        content={doc(paragraph(variable('couple_name')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={onNodeSelect}
      />,
    )
    await waitForEditor('nv11')
    fireEvent.click(screen.getByText('Couple name'))
    expect(onNodeSelect).toHaveBeenCalledWith(expect.objectContaining({ nodeType: 'variable' }))
  })

  it('clicking a chip opens its popover; the fallback commits on blur and shows on the chip', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv12"
        content={doc(paragraph(variable('venue')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv12')
    fireEvent.click(screen.getByText('Venue'))
    const input = await screen.findByLabelText('If empty, show')
    fireEvent.change(input, { target: { value: 'your venue' } })
    // Buffered while typing: nothing lands in the doc per keystroke.
    expect(JSON.stringify(getEditor('nv12')!.getJSON())).not.toContain('your venue')
    fireEvent.blur(input)
    expect(getEditor('nv12')!.getJSON()).toMatchObject(doc(paragraph(variable('venue', 'your venue'))))
    // The fallback reads on the canvas too, not only inside the popover.
    expect(screen.getByText('your venue', { selector: '[data-variable] *' })).toBeInTheDocument()
  })

  it('the chip popover removes the variable', async () => {
    render(
      <ContentSectionEditor
        sectionId="nv13"
        content={doc(paragraph(text('Hi '), variable('couple_name')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />,
    )
    await waitForEditor('nv13')
    fireEvent.click(screen.getByText('Couple name'))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove variable' }))
    expect(getEditor('nv13')!.getJSON()).toMatchObject(doc(paragraph(text('Hi '))))
    expect(JSON.stringify(getEditor('nv13')!.getJSON())).not.toContain('variable')
  })
})
