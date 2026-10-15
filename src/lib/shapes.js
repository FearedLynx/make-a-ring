// Drawing helpers for the pattern editor: stamps, base-pattern generators, symmetry,
// stroke smoothing ("Steady") and shape recognition.
// Tile coordinates: x 0..1 across one tile, y 0..1 across the zone. `A` is the tile aspect
// (physical width / height), used so shapes are round on the real ring, not stretched.

const TAU = Math.PI * 2;
const range = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

// ── Stamps: unit shapes (radius ~1, centred on 0,0) ─────────────
export const STAMPS = [
  { id: 'leaf', name: 'Leaf', pts: () => [...range(20, (t) => [-1 + 2 * t, -0.42 * Math.sin(Math.PI * t)]), ...range(20, (t) => [1 - 2 * t, 0.42 * Math.sin(Math.PI * t)]).slice(1)] },
  { id: 'petal', name: 'Petal', pts: () => range(40, (t) => { const a = t * TAU; return [0.62 * Math.sin(a) * Math.sin(a / 2), -Math.cos(a)]; }) },
  { id: 'heart', name: 'Heart', pts: () => range(48, (t) => { const a = t * TAU; return [(16 * Math.sin(a) ** 3) / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17]; }) },
  { id: 'star', name: 'Star', pts: () => range(10, (t) => { const i = Math.round(t * 10); const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; }) },
  { id: 'diamond', name: 'Diamond', pts: () => [[0, -1], [0.62, 0], [0, 1], [-0.62, 0], [0, -1]] },
  { id: 'dot', name: 'Dot', fill: true, pts: () => range(24, (t) => [Math.cos(t * TAU) * 0.5, Math.sin(t * TAU) * 0.5]) },
  { id: 'ring', name: 'Circle', pts: () => range(32, (t) => [Math.cos(t * TAU), Math.sin(t * TAU)]) },
  { id: 'curl', name: 'Curl', open: true, pts: () => range(60, (t) => { const a = t * 1.7 * TAU; const r = 0.1 + 0.9 * t; return [Math.cos(a) * r, Math.sin(a) * r]; }) },
  { id: 'crescent', name: 'Crescent', pts: () => [
      ...range(24, (t) => { const a = 0.75 + t * (TAU - 1.5); return [Math.cos(a), Math.sin(a)]; }),
      ...range(24, (t) => { const a = TAU - 0.95 - t * (TAU - 1.9); return [0.42 + Math.cos(a) * 0.78, Math.sin(a) * 0.78]; }),
    ] },
  { id: 'drop', name: 'Drop', pts: () => range(40, (t) => { const a = t * TAU; return [0.55 * Math.sin(a) * (1 - Math.cos(a)) / 1.3, -Math.cos(a)]; }) },
];

/** Place a stamp: size is in tile heights, angle in degrees. Returns one stroke. */
export function stampStroke(stamp, cx, cy, size, angleDeg, A, filled = false) {
  const r = (angleDeg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const pts = stamp.pts().map(([px, py]) => {
    const x = (px * c - py * s) * size * 0.5, y = (px * s + py * c) * size * 0.5;
    return [cx + x / A, cy + y];
  });
  return { pts, closed: !stamp.open, fill: !stamp.open && (filled || !!stamp.fill) };
}

// ── Generators: clean, seamless base patterns ───────────────────
export const GENERATORS = [
  { id: 'wave', name: 'Wave' },
  { id: 'zigzag', name: 'Zigzag' },
  { id: 'chain', name: 'Chain' },
  { id: 'scallop', name: 'Scallop' },
  { id: 'dots', name: 'Dots' },
  { id: 'rope', name: 'Rope' },
];

/** cycles: whole repeats per tile (keeps the seam clean); amp: 0..0.45 of the zone; double: add an offset copy. */
export function generate(kind, { cycles = 1, amp = 0.3, double = false }, A) {
  const k = Math.max(1, Math.round(cycles));
  const out = [];
  const line = (pts) => out.push({ pts });
  const shape = (pts, fill = false) => out.push({ pts, closed: true, fill });
  const phases = double ? [0, 0.5] : [0];
  for (const ph of phases) {
    const flip = ph ? -1 : 1;
    if (kind === 'wave') line(range(24 * k, (t) => [t, 0.5 + flip * amp * Math.sin((t * k + 0) * TAU)]));
    if (kind === 'zigzag') line(range(2 * k, (t) => [t, 0.5 + flip * amp * (Math.round(t * 2 * k) % 2 ? 1 : -1)]));
    if (kind === 'scallop') line(range(24 * k, (t) => [t, 0.5 + flip * (amp - 2 * amp * Math.abs(Math.sin(t * k * Math.PI)))]));
    if (kind === 'rope') for (let i = 0; i < k * 2; i++) {
      const x0 = i / (k * 2);
      line(range(12, (t) => [x0 + t / (k * 2) + (ph ? 0.25 / k : 0), 0.5 + amp * (1 - 2 * t) * flip]));
    }
    for (let i = 0; i < k; i++) {
      const cx = (i + 0.5 + ph) / k;
      if (kind === 'chain') shape(range(32, (t) => [cx + (Math.cos(t * TAU) * amp) / A, 0.5 + Math.sin(t * TAU) * amp]));
      if (kind === 'dots') shape(range(20, (t) => [cx + (Math.cos(t * TAU) * amp * 0.45) / A, 0.5 + Math.sin(t * TAU) * amp * 0.45]), true);
    }
  }
  return out;
}

// ── Symmetry: each mode is a list of 2×2 matrices about the tile centre ──
export const SYMMETRY = [
  { id: 'none', name: 'Off', hint: 'No copies' },
  { id: 'mx', name: 'Mirror ↔', hint: 'Mirror left–right' },
  { id: 'my', name: 'Mirror ↕', hint: 'Mirror top–bottom' },
  { id: 'mxy', name: '4-way', hint: 'Mirror both ways' },
  { id: 'rot', name: 'Rotate', hint: 'Rotate 180° (S-curves, twists)' },
  { id: 'kal', name: 'Kaleido', hint: '8 copies: rotations and mirrors' },
];
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
export const inv = (m) => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
};
export function symMats(mode, A) {
  const I = [1, 0, 0, 1], X = [-1, 0, 0, 1], Y = [1, 0, 0, -1], R = [-1, 0, 0, -1];
  const Q = [0, -1 / A, A, 0], Q3 = [0, 1 / A, -A, 0]; // 90° turns in physical space
  switch (mode) {
    case 'mx': return [I, X];
    case 'my': return [I, Y];
    case 'mxy': return [I, X, Y, R];
    case 'rot': return [I, R];
    case 'kal': return [I, X, Y, R, Q, Q3, mul(Q, X), mul(Q3, X)];
    default: return [I];
  }
}
export const applyM = (m, [x, y]) => [0.5 + m[0] * (x - 0.5) + m[1] * (y - 0.5), 0.5 + m[2] * (x - 0.5) + m[3] * (y - 0.5)];
export const applyV = (m, [dx, dy]) => [m[0] * dx + m[1] * dy, m[2] * dx + m[3] * dy];

// ── Steady: simplify, then rebuild as a smooth spline ───────────
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-9;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) (max = d), (idx = i);
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}
function catmull(pts, seg = 10) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function relax(pts, iters) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    p = p.map((pt, i) => (i === 0 || i === p.length - 1 ? pt : [(p[i - 1][0] + 2 * pt[0] + p[i + 1][0]) / 4, (p[i - 1][1] + 2 * pt[1] + p[i + 1][1]) / 4]));
  }
  return p;
}
/** amount 0..100. Works in physical space so smoothing is even in both directions. */
export function steady(pts, amount, A) {
  if (pts.length < 3 || amount <= 0) return pts;
  const s = amount / 100;
  let p = pts.map(([x, y]) => [x * A, y]);
  p = relax(p, Math.round(1 + s * 5));
  p = rdp(p, 0.004 + s * s * 0.06);
  p = catmull(p, 12);
  return p.map(([x, y]) => [x / A, y]);
}

/** Turn a wobbly line or circle into a clean one. Returns a stroke or null. */
export function recognise(pts, A) {
  if (pts.length < 6) return null;
  const q = pts.map(([x, y]) => [x * A, y]);
  let len = 0;
  for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
  const [a, b] = [q[0], q[q.length - 1]];
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Straight line: every point close to the chord.
  if (chord > 0.08 && chord / len > 0.9) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const dev = Math.max(...q.map((p) => Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / chord));
    if (dev < chord * 0.06) return { kind: 'line', stroke: { pts: [pts[0], pts[pts.length - 1]] } };
  }
  // Closed loop: fit an ellipse to the bounding box and check every point sits near it.
  if (len > 0.3 && chord < len * 0.2) {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const rx = (Math.max(...xs) - Math.min(...xs)) / 2, ry = (Math.max(...ys) - Math.min(...ys)) / 2;
    if (rx > 0.01 && ry > 0.01) {
      const d = q.map((p) => Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry));
      const mean = d.reduce((a, v) => a + v, 0) / d.length;
      const sd = Math.sqrt(d.reduce((a, v) => a + (v - mean) ** 2, 0) / d.length);
      if (sd < 0.12) {
        const round = Math.abs(rx - ry) / Math.max(rx, ry) < 0.2;
        const RX = round ? (rx + ry) / 2 : rx, RY = round ? (rx + ry) / 2 : ry;
        return { kind: round ? 'circle' : 'ellipse', stroke: { closed: true, pts: range(48, (t) => [(cx + Math.cos(t * TAU) * RX) / A, cy + Math.sin(t * TAU) * RY]) } };
      }
    }
  }
  return null;
}

/** Lock a segment to 0°, 45° or 90° (physical angles). */
export function constrain(from, to, A) {
  const dx = (to[0] - from[0]) * A, dy = to[1] - from[1];
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return [from[0] + (Math.cos(ang) * len) / A, from[1] + Math.sin(ang) * len];
}
