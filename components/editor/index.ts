/**
 * Shared editor primitives: toolbar controls, the position picker, the
 * popover select, the slider, the numeric stepper, the resize grip and
 * its drag maths, and the zoomable canvas frame. The Branding editor and
 * the proposal section editor (Proposal Layout v2 Phase 2, spec 5.3) both
 * build their toolbars and canvases out of this one set, so neither
 * drifts from the other.
 *
 * @module components/editor
 */
export { PillToggle, ActiveTargetLabel, VAlignIcon, ToolbarDivider, IncludeDropdown } from './toolbar-primitives'
export type { IncludeRow } from './toolbar-primitives'

export { PositionControl } from './position-control'

export { Select } from './select'
export type { SelectOption } from './select'

export { Slider } from './slider'

export { NumberStepper } from './number-stepper'
export type { NumberStepperProps } from './number-stepper'

export { ResizeGrip } from './resize-grip'
export type { ResizeGripProps } from './resize-grip'

export { applySnaps, clamp, dragValue, stepRound, zoomFactor } from './resize-math'
export type { Snap } from './resize-math'

export { CanvasFrame } from './canvas-frame'
export type { CanvasFrameProps, CanvasDevice } from './canvas-frame'
