'use client';

import { useState } from 'react';

import {
  ActiveTargetLabel,
  CanvasFrame,
  IncludeDropdown,
  NumberStepper,
  PillToggle,
  PositionControl,
  ResizeGrip,
  Select,
  Slider,
  ToolbarDivider,
  type CanvasDevice,
} from '@/components/editor';

import { Example, Rule, SampleFrame, Spec } from './showroom';

/**
 * The shared editor primitives in `components/editor/`: the toolbar
 * controls, position picker, select, slider, numeric stepper and the
 * zoomable canvas frame the Branding editor and the proposal section
 * editor both build on (Proposal Layout v2 Phase 2, spec 5.3).
 *
 * @module app/design-system/editor-primitives
 */

/** One `Spec` per primitive in `components/editor/`. */
export function EditorPrimitives() {
  const [pill, setPill] = useState<'left' | 'center' | 'right'>('left');
  const [include, setInclude] = useState({ heading: true, subheading: false });
  const [h, setH] = useState<'left' | 'center' | 'right'>('center');
  const [v, setV] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [font, setFont] = useState('inter');
  const [slider, setSlider] = useState(40);
  const [padding, setPadding] = useState(48);
  const [gripHeight, setGripHeight] = useState(96);

  return (
    <>
      <Rule>
        Every one of these is a shared cross-editor primitive: import it from{' '}
        <code>@/components/editor</code> rather than reaching into the Branding editor for it.
      </Rule>

      <Spec name="PillToggle" importPath="@/components/editor">
        <Example code={`<PillToggle options={[...]} value={pill} onChange={setPill} />`}>
          <SampleFrame>
            <PillToggle
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              value={pill}
              onChange={setPill}
            />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="ActiveTargetLabel" importPath="@/components/editor">
        <Example code={`<ActiveTargetLabel label="Heading" />`}>
          <SampleFrame>
            <ActiveTargetLabel label="Heading" />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="ToolbarDivider" importPath="@/components/editor">
        <Example code={`<span>A</span><ToolbarDivider /><span>B</span>`}>
          <SampleFrame>
            <div className="flex items-center gap-2">
              <span className="text-body text-text">A</span>
              <ToolbarDivider />
              <span className="text-body text-text">B</span>
            </div>
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="IncludeDropdown" importPath="@/components/editor">
        <Example code={`<IncludeDropdown rows={[{ label: 'Heading', active, set }]} />`}>
          <SampleFrame>
            <IncludeDropdown
              rows={[
                { label: 'Heading', active: include.heading, set: (val) => setInclude((s) => ({ ...s, heading: val })) },
                { label: 'Subheading', active: include.subheading, set: (val) => setInclude((s) => ({ ...s, subheading: val })) },
              ]}
            />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="PositionControl" importPath="@/components/editor">
        <Example code={`<PositionControl h={h} v={v} onChange={(h, v) => ...} />`}>
          <SampleFrame>
            <PositionControl h={h} v={v} onChange={(nh, nv) => { setH(nh); setV(nv); }} />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="Select" importPath="@/components/editor">
        <Example code={`<Select size="xs" value={font} options={[...]} onChange={setFont} />`}>
          <SampleFrame>
            <div className="w-40">
              <Select
                size="xs"
                value={font}
                options={[
                  { value: 'inter', label: 'Inter' },
                  { value: 'lora', label: 'Lora' },
                ]}
                onChange={setFont}
              />
            </div>
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="Slider" importPath="@/components/editor">
        <Example code={`<Slider value={slider} min={0} max={100} onChange={setSlider} ariaLabel="Overlay" />`}>
          <SampleFrame>
            <div className="w-40">
              <Slider value={slider} min={0} max={100} onChange={setSlider} ariaLabel="Overlay" />
            </div>
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="NumberStepper" importPath="@/components/editor">
        <Example code={`<NumberStepper value={padding} min={0} max={64} step={4} onChange={setPadding} ariaLabel="Padding" suffix="px" />`}>
          <SampleFrame>
            <NumberStepper value={padding} min={0} max={64} step={4} onChange={setPadding} ariaLabel="Padding" suffix="px" />
          </SampleFrame>
        </Example>
      </Spec>

      <Spec
        name="ResizeGrip"
        importPath="@/components/editor"
        description="The drag handle every resize control builds on (section height/width, image, columns, spacer, the Branding hero). Drag the bottom edge or focus it and use the arrow keys."
      >
        <Example code={`<ResizeGrip axis="y" value={height} min={40} max={240} step={8} snaps={[{ value: 96, label: 'Cozy' }]} tolerance={4} format={(v) => \`\${v}px\`} onChange={setHeight} ariaLabel="Section height" />`}>
          <SampleFrame>
            <div className="relative w-full rounded-control border border-border bg-surface-muted" style={{ height: gripHeight }}>
              <div className="flex h-full items-center justify-center text-body text-text-muted">{gripHeight}px</div>
              <ResizeGrip
                axis="y"
                value={gripHeight}
                min={40}
                max={240}
                step={8}
                snaps={[{ value: 96, label: 'Cozy' }]}
                tolerance={4}
                format={(v) => `${v}px`}
                onChange={setGripHeight}
                ariaLabel="Section height"
              />
            </div>
          </SampleFrame>
        </Example>
      </Spec>

      <Spec name="CanvasFrame" importPath="@/components/editor" description="The zoomable, pannable document viewport. Needs a sized flex parent.">
        <Example code={`<CanvasFrame device="desktop" zoom={1} setZoom={setZoom}>{children}</CanvasFrame>`}>
          <CanvasFrameDemo />
        </Example>
      </Spec>
    </>
  );
}

/** CanvasFrame needs a sized flex parent to zoom/pan within; 320px stands in for the editor's canvas column. */
function CanvasFrameDemo() {
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [zoom, setZoom] = useState(1);
  return (
    <SampleFrame>
      <div className="mb-3">
        <PillToggle
          options={[
            { value: 'desktop', label: 'Desktop' },
            { value: 'mobile', label: 'Mobile' },
          ]}
          value={device}
          onChange={setDevice}
        />
      </div>
      <div className="flex h-[320px] flex-col rounded-control border border-border">
        <CanvasFrame device={device} zoom={zoom} setZoom={setZoom} wide={false}>
          <div className="flex h-64 w-full items-center justify-center rounded-control bg-surface text-body text-text-muted">
            Document content
          </div>
        </CanvasFrame>
      </div>
    </SampleFrame>
  );
}
