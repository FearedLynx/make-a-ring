// Geometry of the size drawing on the "Your size" step (pure functions, tested in tests/size-drawing.test.js).
// The ring is drawn in front view like an engineering drawing, enlarged a fixed 8 units per millimetre so the inner
// contour really grows and shrinks in proportion with the size.
import { usToDiameter } from './sizes.js';

export const DRAW = { w: 340, h: 300, cx: 170, cy: 156, scale: 8, wallMm: 2, min: 4, max: 13 };

const clamp = (us) => Math.min(DRAW.max, Math.max(DRAW.min, us));

/** Inner radius in drawing units for a size (accepts in-between values while it animates). */
export const innerRadius = (us) => (usToDiameter(clamp(us)) / 2) * DRAW.scale;

/** Outer radius: the inner one plus the wall. */
export const outerRadius = (us) => innerRadius(us) + DRAW.wallMm * DRAW.scale;

/** Ring in front view as one even-odd path: outer circle, then the hole. */
export function annulus(rIn, rOut, cx = DRAW.cx, cy = DRAW.cy) {
  const ring = (r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  return ring(rOut) + ring(rIn);
}

/** Circle as a path, so it can be drawn on with a pen stroke (pathLength 1). Starts at 9 o'clock. */
export const circle = (r, cx = DRAW.cx, cy = DRAW.cy) => `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0`;

/** Diameter label as the drawing writes it. */
export const diaLabel = (us) => `Ø ${usToDiameter(clamp(us)).toFixed(1)}`;
