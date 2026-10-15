// Pattern library.
// A pattern is one repeatable tile. Coordinates are tile units:
//   x: 0..1 along the circumference (one tile width)
//   y: 0..1 across the zone (for side zones y=0 is the outer edge of the ring)
// `aspect` is the physical tile width divided by the zone height, so a tile with
// aspect 1 is square on the real ring. `sw` is the stroke width relative to zone height.

const TAU = Math.PI * 2;

const sample = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));

// Circle/ellipse helpers work in physical units (corrected by the tile aspect).
const ellipse = (A, cx, cy, rx, ry, rot = 0, n = 28) =>
  sample(n, (t) => {
    const a = t * TAU;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    return [cx + xr / A, cy + yr];
  });
const circle = (A, cx, cy, r, n = 28) => ellipse(A, cx, cy, r, r, 0, n);

const spiral = (A, cx, cy, r0, r1, turns, start = 0, n = 60) =>
  sample(n, (t) => {
    const a = start + t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    return [cx + (Math.cos(a) * r) / A, cy + Math.sin(a) * r];
  });

const star = (A, cx, cy, ro, ri, points = 5) => {
  const pts = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? ri : ro;
    pts.push([cx + (Math.cos(a) * r) / A, cy + Math.sin(a) * r]);
  }
  return pts;
};

const heart = (A, cx, cy, s) =>
  sample(48, (t) => {
    const a = t * TAU;
    const x = 16 * Math.sin(a) ** 3;
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    return [cx + (x * s) / 17 / A, cy - (y * s) / 17];
  });

const bezier = (p0, p1, p2, p3, n = 24) =>
  sample(n, (t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  });

const line = (...pts) => ({ pts });
const closed = (pts) => ({ pts, closed: true });
const filled = (pts) => ({ pts, closed: true, fill: true });

function def(id, name, zone, tags, aspect, sw, build) {
  return { id, name, zone, tags, aspect, sw, strokes: build(aspect) };
}

export const PATTERNS = [
  // ── Middle patterns ────────────────────────────────────────────
  def('lattice', 'Lattice', 'middle', ['classic', 'geometric'], 1.5, 0.07, () => [
    line(...sample(40, (t) => [t, 0.5 + 0.36 * Math.sin(t * TAU)])),
    line(...sample(40, (t) => [t, 0.5 - 0.36 * Math.sin(t * TAU)])),
  ]),
  def('diamonds', 'Diamond Row', 'middle', ['classic', 'geometric'], 0.95, 0.085, () => [
    closed([[0.5, 0.12], [0.88, 0.5], [0.5, 0.88], [0.12, 0.5]]),
  ]),
  def('feather', 'Feather', 'middle', ['organic', 'bold'], 0.5, 0.075, () => [
    line([0, 0.5], [1, 0.5]),
    line([0.1, 0.12], [0.75, 0.5], [0.1, 0.88]),
  ]),
  def('greek-key', 'Greek Key', 'middle', ['classic', 'geometric'], 1.05, 0.075, () => [
    line([0, 0.88], [1, 0.88]),
    line([0.12, 0.88], [0.12, 0.12], [0.86, 0.12], [0.86, 0.64], [0.38, 0.64], [0.38, 0.38], [0.62, 0.38]),
  ]),
  def('botanica', 'Botanica', 'middle', ['floral', 'organic'], 1.25, 0.06, (A) => [
    line(...sample(32, (t) => [t, 0.5 + 0.07 * Math.sin(t * TAU)])),
    closed(ellipse(A, 0.27, 0.3, 0.2, 0.09, -0.55)),
    closed(ellipse(A, 0.75, 0.7, 0.2, 0.09, 0.55)),
  ]),
  def('starlight', 'Starlight', 'middle', ['celestial', 'bold'], 1, 0.07, (A) => [
    closed(star(A, 0.5, 0.52, 0.38, 0.16)),
  ]),
  def('interlace', 'Interlace', 'middle', ['celtic', 'classic'], 1.3, 0.065, (A) => [
    line(...sample(40, (t) => [t, 0.5 + 0.34 * Math.sin(t * TAU)])),
    line(...sample(40, (t) => [t, 0.5 - 0.34 * Math.sin(t * TAU)])),
    closed(circle(A, 0.25, 0.5, 0.17)),
    closed(circle(A, 0.75, 0.5, 0.17)),
  ]),
  def('hearts', 'Hearts', 'middle', ['romantic'], 1, 0.075, (A) => [
    closed(heart(A, 0.5, 0.5, 0.36)),
  ]),
  def('rings', 'Linked Rings', 'middle', ['geometric', 'minimal'], 0.6, 0.06, (A) => [
    closed(circle(A, 0.5, 0.5, 0.34)),
  ]),
  def('moons', 'Moon Phases', 'middle', ['celestial'], 1.1, 0.065, (A) => [
    closed(circle(A, 0.3, 0.5, 0.28)),
    filled(circle(A, 0.75, 0.5, 0.12)),
  ]),

  // ── Side patterns (y=0 is the ring edge) ───────────────────────
  def('filigree', 'Filigree', 'side', ['classic', 'floral'], 0.75, 0.09, (A) => [
    line(...spiral(A, 0.5, 0.52, 0.04, 0.34, 1.6, 0)),
  ]),
  def('vine-scroll', 'Vine Scroll', 'side', ['floral', 'organic'], 1.6, 0.08, (A) => [
    line(...sample(40, (t) => [t, 0.5 + 0.22 * Math.sin(t * TAU)])),
    line(...spiral(A, 0.25, 0.28, 0.03, 0.16, 1.1, Math.PI / 2, 36)),
    line(...spiral(A, 0.75, 0.72, 0.03, 0.16, 1.1, -Math.PI / 2, 36)),
  ]),
  def('morse', 'Morse', 'side', ['minimal'], 1, 0.12, () => [line([0.15, 0.5], [0.75, 0.5])]),
  def('scallop', 'Scallop', 'side', ['classic', 'organic'], 0.9, 0.1, () => [
    line(...sample(28, (t) => [t, 0.15 + 0.68 * Math.sin(t * Math.PI)])),
  ]),
  def('laurel', 'Laurel', 'side', ['floral', 'classic'], 0.85, 0.07, (A) => [
    line([0, 0.5], [1, 0.5]),
    closed(ellipse(A, 0.45, 0.3, 0.22, 0.09, -0.5)),
    closed(ellipse(A, 0.45, 0.7, 0.22, 0.09, 0.5)),
  ]),
  def('twin-rail', 'Twin Rail', 'side', ['minimal'], 1, 0.11, () => [
    line([0, 0.3], [1, 0.3]),
    line([0, 0.72], [1, 0.72]),
  ]),
  def('sawtooth', 'Sawtooth', 'side', ['bold', 'geometric'], 0.8, 0.1, () => [
    line([0, 0.82], [0.85, 0.18], [0.85, 0.82], [1, 0.82]),
  ]),
  def('pearls', 'Pearl Line', 'side', ['classic', 'minimal'], 0.5, 0.1, (A) => [
    filled(circle(A, 0.5, 0.5, 0.2)),
  ]),

  // ── Patterns that work anywhere ────────────────────────────────
  def('wave', 'Ocean Wave', 'any', ['organic', 'minimal'], 1.6, 0.09, () => [
    line(...sample(40, (t) => [t, 0.5 + 0.3 * Math.sin(t * TAU)])),
  ]),
  def('zigzag', 'Zigzag', 'any', ['geometric', 'bold'], 0.8, 0.09, () => [
    line([0, 0.22], [0.5, 0.78], [1, 0.22]),
  ]),
  def('rope', 'Rope Twist', 'any', ['classic'], 0.45, 0.1, () => [
    line(...bezier([0.05, 0.92], [0.2, 0.4], [0.8, 0.6], [0.95, 0.08])),
  ]),
  def('beads', 'Beads', 'any', ['minimal'], 0.55, 0.1, (A) => [filled(circle(A, 0.5, 0.5, 0.22))]),
];

export const TAGS = ['classic', 'geometric', 'floral', 'organic', 'minimal', 'bold', 'celtic', 'celestial', 'romantic'];

export function fitsZone(pattern, zone) {
  if (!pattern) return true;
  const kind = zone === 'middle' ? 'middle' : 'side';
  return pattern.zone === 'any' || pattern.zone === kind;
}

/** Chaikin smoothing for freehand strokes drawn in the editor. */
export function smoothStroke(pts, iterations = 2) {
  let out = pts;
  for (let k = 0; k < iterations; k++) {
    if (out.length < 3) return out;
    const next = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [x0, y0] = out[i], [x1, y1] = out[i + 1];
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** Drop points closer than `eps` to the previous kept point. */
export function thinStroke(pts, eps = 0.012) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = out[out.length - 1];
    if (Math.hypot(pts[i][0] - x, pts[i][1] - y) >= eps) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export { circle as circlePoints };
