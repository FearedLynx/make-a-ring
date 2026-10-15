// Geometry of the unrolled band: where each zone sits and how its tile repeats.
import { layoutZones } from './templates.js';
import { usToCircumference, usToDiameter } from './sizes.js';

export function bandMetrics(design) {
  const innerD = usToDiameter(design.sizeUS);
  // Outer circumference is where the pattern lives.
  const outerD = innerD + 2 * design.thickness;
  return { innerD, outerD, circ: Math.PI * outerD, innerCirc: usToCircumference(design.sizeUS) };
}

/**
 * Resolve the zones of a design into physical numbers.
 * getPattern(id) returns a pattern object or null.
 */
export function resolveZones(design, getPattern) {
  const { circ } = bandMetrics(design);
  return layoutZones(design).zones.map((z) => {
    const pattern = getPattern(design.patterns[z.id]);
    const heightMM = (z.to - z.from) * design.width;
    let repeats = 0;
    if (pattern) {
      const override = z.id === 'middle' ? design.repeats.middle : design.repeats.side;
      const natural = circ / Math.max(0.2, pattern.aspect * heightMM);
      repeats = override || Math.max(2, Math.round(natural));
    }
    const lineMM = pattern ? lineWidthMM(pattern, heightMM) : 0;
    return { ...z, pattern, heightMM, repeats, lineMM, flip: z.id === 'sideR' };
  });
}

// Lines never go below a printable base weight, the way jewellery CAD tools clamp engraving width.
export const BASE_LINE_MM = 0.38;
// Hand-drawn patterns carry their own line weight in mm (`lw`); built-ins scale with the zone.
export const MIN_LINE_MM = 0.2; // nothing prints finer than this
export const lineWidthMM = (pattern, zoneHeightMM) =>
  pattern.lw ? Math.max(pattern.lw, MIN_LINE_MM) : Math.max(pattern.sw * zoneHeightMM, BASE_LINE_MM);
