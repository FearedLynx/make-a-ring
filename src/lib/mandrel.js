// Geometry of the decorative ring mandrel on the "Your size" step. Pure functions, unit-tested in
// tests/mandrel.test.js. Positions along the cone come from real inner diameters (same formula as the
// size table in sizes.js), so the tick spacing is true; the cone's taper is drawn exaggerated (about 2.8×
// from top to bottom instead of the real ~1.5×) so it reads as a cone at a glance.
import { usToDiameter } from './sizes.js';

export const MANDREL = {
  width: 240, // SVG viewBox
  height: 470, // room for the collar, handle and its shadow under the cone
  cx: 104, // cone axis; ticks and labels sit to the right
  yTop: 44, // where size 3½ would sit
  coneHeight: 312, // from size 3½ to size 13½
  topHalfWidth: 20,
  bottomHalfWidth: 56,
  usMin: 3.5,
  usMax: 13.5,
};

const D_MIN = usToDiameter(MANDREL.usMin);
const D_MAX = usToDiameter(MANDREL.usMax);

/** Inner diameter in mm for a US size (the app's single source of truth for sizes). */
export const diameterMm = (us) => usToDiameter(us);

/** Vertical position on the cone for a US size: bigger sizes sit lower, where the cone is wider. */
export function ringY(us, M = MANDREL) {
  return M.yTop + ((diameterMm(us) - D_MIN) / (D_MAX - D_MIN)) * M.coneHeight;
}

/** Half the cone's drawn width at height y (linear taper, clamped to the drawn cone). */
export function coneHalfWidthAt(y, M = MANDREL) {
  const t = Math.min(1, Math.max(0, (y - M.yTop) / M.coneHeight));
  return M.topHalfWidth + t * (M.bottomHalfWidth - M.topHalfWidth);
}

/** The ring seen slightly from above: an ellipse hugging the cone at that size. */
export function ringEllipse(us, M = MANDREL) {
  return ellipseAtY(ringY(us, M), M);
}

/** Same, for any y (used while the ring is moving between sizes). */
export function ellipseAtY(y, M = MANDREL) {
  const rx = coneHalfWidthAt(y, M) + 2.5;
  return { cx: M.cx, cy: y, rx, ry: rx * 0.22 };
}

/** Tick marks: whole sizes 4–13 get a long tick and a label, half sizes a short tick. */
export function ticks(M = MANDREL) {
  const out = [];
  for (let us = 4; us <= 13; us += 0.5) out.push({ us, y: ringY(us, M), whole: us % 1 === 0 });
  return out;
}
